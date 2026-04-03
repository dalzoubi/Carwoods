// Deploy with: az deployment group create -g carwoods.com -f main.bicep
// targetScope defaults to resourceGroup — deploy INTO existing RG carwoods.com

@description('Azure region for resources (defaults to resource group location).')
param location string = resourceGroup().location

@description('Globally unique storage account name (lowercase, no hyphens, max 24 chars).')
param storageAccountName string

@description('Globally unique Function App name.')
param functionAppName string

@description('Node.js version on Functions.')
param nodeVersion string = '20'

var hostingPlanName = '${functionAppName}-plan'

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
