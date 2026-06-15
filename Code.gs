var START_ROW = 5;

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙️ QBO Sync')
    .addItem('1. Authorize App', 'showAuthSidebar')
    .addItem('2. Sync Cash Flow Data', 'syncProfitAndLoss')
    .addSeparator()
    .addItem('⚠️ Clear Saved Tokens', 'clearTokens')
    .addToUi();
}

function showAuthSidebar() {
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('QBO_CLIENT_ID');
  var redirectUri = props.getProperty('WEB_APP_URL');
  
  if (!redirectUri) {
    SpreadsheetApp.getUi().alert('Error: You must save your WEB_APP_URL in Project Settings first!');
    return;
  }
  
  var authorizationUrl = 'https://appcenter.intuit.com/connect/oauth2' +
    '?client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&response_type=code' +
    '&scope=com.intuit.quickbooks.accounting' +
    '&state=SIMPLE_BYPASS';
    
  var htmlContent = '<div style="font-family: Arial, sans-serif; padding: 10px;">' +
    '<p>Click the button below to connect your file:</p>' +
    '<a href="' + authorizationUrl + '" target="_blank" style="display: inline-block; padding: 12px 20px; background-color: #0077C5; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; text-align: center; width: 85%;">Connect to QuickBooks</a>' +
    '</div>';
    
  var sidebar = HtmlService.createHtmlOutput(htmlContent).setTitle('QBO Authentication');
  SpreadsheetApp.getUi().showSidebar(sidebar);
}

function doGet(e) {
  var props = PropertiesService.getScriptProperties();
  var code = e.parameter.code;
  
  if (!code) {
    return HtmlService.createHtmlOutput('<h3>Handshake Stopped</h3><p>No authorization code received from Intuit.</p>');
  }
  
  var redirectUri = props.getProperty('WEB_APP_URL');
  var tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  var clientId = props.getProperty('QBO_CLIENT_ID');
  var clientSecret = props.getProperty('QBO_CLIENT_SECRET');
  var authHeader = 'Basic ' + Utilities.base64Encode(clientId + ':' + clientSecret);
  
  var payload = {
    'code': code,
    'redirect_uri': redirectUri,
    'grant_type': 'authorization_code'
  };
  
  var options = {
    'method': 'post',
    'headers': {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    'payload': payload,
    'muteHttpExceptions': true
  };
  
  try {
    var response = UrlFetchApp.fetch(tokenUrl, options);
    var tokenData = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() === 200) {
      props.setProperty('QBO_ACCESS_TOKEN', tokenData.access_token);
      props.setProperty('QBO_REFRESH_TOKEN', tokenData.refresh_token);
      props.setProperty('QBO_TOKEN_EXPIRES', (Math.floor(Date.now() / 1000) + tokenData.expires_in).toString());
      return HtmlService.createHtmlOutput('<h3>Success! Connection established.</h3><p>You can close this window and click "2. Sync Cash Flow Data".</p>');
    } else {
      return HtmlService.createHtmlOutput('<h3>Token Exchange Failed</h3><p>' + response.getContentText() + '</p>');
    }
  } catch (err) {
    return HtmlService.createHtmlOutput('<h3>Network Error</h3><p>' + err.toString() + '</p>');
  }
}

function getValidAccessToken() {
  var props = PropertiesService.getScriptProperties();
  var expireTime = parseInt(props.getProperty('QBO_TOKEN_EXPIRES') || '0');
  var currentTime = Math.floor(Date.now() / 1000);
  
  if (props.getProperty('QBO_ACCESS_TOKEN') && currentTime < (expireTime - 60)) {
    return props.getProperty('QBO_ACCESS_TOKEN');
  }
  
  var refreshToken = props.getProperty('QBO_REFRESH_TOKEN');
  if (!refreshToken) return null;
  
  var tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  var clientId = props.getProperty('QBO_CLIENT_ID');
  var clientSecret = props.getProperty('QBO_CLIENT_SECRET');
  var authHeader = 'Basic ' + Utilities.base64Encode(clientId + ':' + clientSecret);
  
  var payload = {
    'refresh_token': refreshToken,
    'grant_type': 'refresh_token'
  };
  
  var options = {
    'method': 'post',
    'headers': {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    'payload': payload,
    'muteHttpExceptions': true
  };
  
  var response = UrlFetchApp.fetch(tokenUrl, options);
  var tokenData = JSON.parse(response.getContentText());
  
  if (response.getResponseCode() === 200) {
    props.setProperty('QBO_ACCESS_TOKEN', tokenData.access_token);
    if (tokenData.refresh_token) {
      props.setProperty('QBO_REFRESH_TOKEN', tokenData.refresh_token);
    }
    props.setProperty('QBO_TOKEN_EXPIRES', (Math.floor(Date.now() / 1000) + tokenData.expires_in).toString());
    return tokenData.access_token;
  }
  return null;
}

function syncProfitAndLoss() {
  var accessToken = getValidAccessToken();
  if (!accessToken) {
    SpreadsheetApp.getUi().alert('Please authorize the app first using option 1.');
    return;
  }
  
  var props = PropertiesService.getScriptProperties();
  var realmId = props.getProperty('QBO_REALM_ID');
  
  var url = 'https://quickbooks.api.intuit.com/v3/company/' + realmId + 
            '/reports/ProfitAndLoss' +
            '?accounting_method=Cash' +
            '&summarize_column_by=Month' +
            '&start_date=2026-01-01' +
            '&end_date=2026-12-31';
            
  var options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Accept': 'application/json'
    },
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(response.getContentText());
  
  if (response.getResponseCode() !== 200) {
    Logger.log(response.getContentText());
    SpreadsheetApp.getUi().alert('Error fetching data from QBO. Check Logs.');
    return;
  }
  
  parseAndWriteToSheet(json);
}

function parseAndWriteToSheet(jsonPayload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var outputRows = [];

  if (jsonPayload.Columns && jsonPayload.Columns.Column) {
    var headerRow = [];
    jsonPayload.Columns.Column.forEach(function(col) {
      headerRow.push(col.ColTitle || '');
    });
    outputRows.push(headerRow);
  }

  function extractRows(rows) {
    if (!rows || !rows.Row) return;
    rows.Row.forEach(function(row) {
      if (row.Header && row.Header.ColData) {
        var headerLine = [];
        row.Header.ColData.forEach(function(cell) { headerLine.push(cell.value || ''); });
        outputRows.push(headerLine);
      }
      if (row.ColData) {
        var dataLine = [];
        row.ColData.forEach(function(cell) { dataLine.push(cell.value || ''); });
        outputRows.push(dataLine);
      }
      if (row.Rows) {
        extractRows(row.Rows);
      }
      if (row.Summary && row.Summary.ColData) {
        var summaryLine = [];
        row.Summary.ColData.forEach(function(cell) { summaryLine.push(cell.value || ''); });
        outputRows.push(summaryLine);
      }
    });
  }

  extractRows(jsonPayload.Rows);

  if (outputRows.length > 0) {
    sheet.getRange(START_ROW, 1, outputRows.length, outputRows[0].length).setValues(outputRows);
    SpreadsheetApp.getUi().alert('Data successfully synced from QBO!');
  } else {
    SpreadsheetApp.getUi().alert('No data rows found to paste.');
  }
}

function clearTokens() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('QBO_ACCESS_TOKEN');
  props.deleteProperty('QBO_REFRESH_TOKEN');
  props.deleteProperty('QBO_TOKEN_EXPIRES');
  SpreadsheetApp.getUi().alert('Saved authentication credentials cleared.');
}
