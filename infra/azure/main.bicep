// Deploy with: az deployment group create -g carwoods.com -f main.bicep
// targetScope defaults to resourceGroup — deploy INTO existing RG carwoods.com

@description('Azure region for most resources (defaults to resource group location).')
param location string = resourceGroup().location

@description('Azure region for the PostgreSQL Flexible Server. Defaults to location. Override when the subscription is offer-restricted in the primary region.')
param postgresLocation string = location

@description('Globally unique storage account name (lowercase, no hyphens, max 24 chars).')
param storageAccountName string

@description('Globally unique Function App name.')
param functionAppName string

@description('Node.js version on Functions.')
param nodeVersion string = '20'

@description('Globally unique PostgreSQL Flexible Server name (lowercase, alphanumeric + hyphens, 3–63 chars).')
param postgresServerName string

@description('PostgreSQL admin user (cannot be azure_superuser, admin, etc.).')
param postgresAdminUser string = 'carwoodsadmin'

@secure()
@description('PostgreSQL admin password. Avoid @ : / ? # and spaces in DATABASE_URL compatibility.')
param postgresAdminPassword string

@description('Logical database created on the server for the portal.')
param postgresDatabaseName string = 'carwoods_portal'

var hostingPlanName = '${functionAppName}-plan'

var databaseUrl = 'postgresql://${postgresAdminUser}:${postgresAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${postgresDatabaseName}?sslmode=require'

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

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresServerName
  location: postgresLocation
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminUser
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: postgresDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allows Azure services (including Consumption Functions outbound) to reach the server.
resource postgresFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
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

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  dependsOn: [
    postgresDb
    postgresFirewallAzure
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

output functionAppNameOut string = functionApp.name
output functionAppHost string = 'https://${functionApp.properties.defaultHostName}'
output storageAccountNameOut string = storage.name
output principalId string = functionApp.identity.principalId
output postgresServerNameOut string = postgres.name
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
output postgresDatabaseNameOut string = postgresDatabaseName
