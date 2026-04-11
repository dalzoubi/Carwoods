// Deploy with: az deployment group create -g carwoods.com -f main.bicep
// targetScope defaults to resourceGroup — deploy INTO existing RG carwoods.com

@description('Azure region for resources (defaults to resource group location).')
param location string = resourceGroup().location

@description('Globally unique storage account name (lowercase, no hyphens, max 24 chars).')
param storageAccountName string

@description('Globally unique Function App name.')
param functionAppName string

@description('When true, keep an existing Function App as-is (no plan/site mutation).')
param adoptExistingFunctionApp bool = false

@description('Node.js version on Functions.')
param nodeVersion string = '24'

@description('Globally unique Azure SQL logical server name (lowercase, alphanumeric + hyphens, 1–63 chars).')
param sqlServerName string

@description('Azure SQL admin login.')
param sqlAdminUser string = 'carwoodsadmin'

@secure()
@description('Azure SQL admin password (min 8 chars, must include uppercase, lowercase, digit, special).')
param sqlAdminPassword string

@description('Database name on the logical SQL server.')
param sqlDatabaseName string = 'carwoods_portal_prod'

@description('Globally unique Azure Communication Services name. Leave empty to skip ACS provisioning.')
param communicationServiceName string = 'carwoods_portal_acs'

@description('ACS data location (for example: UnitedStates).')
param communicationDataLocation string = 'UnitedStates'

var hostingPlanName = '${functionAppName}-plan'
var deployCommunicationService = !empty(trim(communicationServiceName))

// mssql connection string accepted by the tedious driver via the DATABASE_URL env var.
// Format: Server=<fqdn>,1433;Database=<db>;User Id=<user>;Password=<pass>;Encrypt=yes;TrustServerCertificate=no
var databaseUrl = 'Server=${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${sqlDatabaseName};User Id=${sqlAdminUser};Password=${sqlAdminPassword};Encrypt=yes;TrustServerCertificate=no'

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

// Azure SQL logical server (hosts one or more databases)
resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: sqlAdminUser
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

// Cheapest non-serverless option: Basic tier, 5 DTUs, 2 GiB. ~$5/month.
resource sqlDb 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 5
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648 // 2 GiB (Basic max)
    zoneRedundant: false
    readScale: 'Disabled'
    requestedBackupStorageRedundancy: 'Local'
  }
}

// Allows all Azure-internal IPs (including Consumption Functions) to reach the server.
resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' = if (deployCommunicationService) {
  name: communicationServiceName
  location: 'global'
  properties: {
    dataLocation: communicationDataLocation
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = if (!adoptExistingFunctionApp) {
  name: hostingPlanName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = if (!adoptExistingFunctionApp) {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  dependsOn: [
    sqlDb
    sqlFirewallAzure
  ]
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|${nodeVersion}'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'AzureWebJobsFeatureFlags'
          value: 'EnableWorkerIndexing'
        }
        {
          name: 'DATABASE_URL'
          value: databaseUrl
        }
      ]
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

output functionAppNameOut string = functionAppName
output functionAppHost string = 'https://${reference(resourceId('Microsoft.Web/sites', functionAppName), '2023-12-01').defaultHostName}'
output storageAccountNameOut string = storage.name
output principalId string = reference(resourceId('Microsoft.Web/sites', functionAppName), '2023-12-01', 'full').identity.principalId
output sqlServerNameOut string = sqlServer.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseNameOut string = sqlDatabaseName
output communicationServiceNameOut string = deployCommunicationService ? communicationService.name : ''
output communicationServiceEndpoint string = deployCommunicationService ? communicationService!.properties.hostName : ''
