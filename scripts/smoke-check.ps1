param(
  [string]$BaseUrl = 'http://localhost:1337',
  [string]$ManagerJwt = '',
  [string]$ActorTokenSecret = ''
)

$ErrorActionPreference = 'Stop'

function Write-Step {
  param([string]$Message)
  Write-Host "[smoke] $Message"
}

function Fail {
  param([string]$Message)
  throw "[smoke] FAIL: $Message"
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Url,
    [string]$BodyJson = '',
    [string[]]$Headers = @()
  )

  $bodyFile = $null
  $responseFile = New-TemporaryFile
  try {
    $args = @('-s', '-o', $responseFile.FullName, '-w', '%{http_code}', '-X', $Method)

    foreach ($header in $Headers) {
      if ($header) {
        $args += @('-H', $header)
      }
    }

    if ($BodyJson) {
      $bodyFile = New-TemporaryFile
      Set-Content -Path $bodyFile.FullName -Value $BodyJson -NoNewline -Encoding UTF8
      $args += @('-H', 'Content-Type: application/json', '--data-binary', "@$($bodyFile.FullName)")
    }

    $args += $Url
    $statusText = (& curl.exe @args)
    $rawBody = Get-Content -Path $responseFile.FullName -Raw

    $parsedBody = $null
    if ($rawBody) {
      try {
        $parsedBody = $rawBody | ConvertFrom-Json
      } catch {
        $parsedBody = $null
      }
    }

    return [PSCustomObject]@{
      StatusCode = [int]$statusText
      RawBody = $rawBody
      Json = $parsedBody
    }
  } finally {
    if ($bodyFile -and (Test-Path $bodyFile.FullName)) {
      Remove-Item $bodyFile.FullName -ErrorAction SilentlyContinue
    }
    if (Test-Path $responseFile.FullName) {
      Remove-Item $responseFile.FullName -ErrorAction SilentlyContinue
    }
  }
}

function Invoke-StatusOnly {
  param(
    [string]$Url,
    [string[]]$Headers = @()
  )
  $args = @('-s', '-o', 'NUL', '-w', '%{http_code}')
  foreach ($header in $Headers) {
    if ($header) {
      $args += @('-H', $header)
    }
  }
  $args += $Url
  $statusText = (& curl.exe @args)
  return [int]$statusText
}

function Invoke-Text {
  param(
    [string]$Url,
    [string[]]$Headers = @()
  )
  $args = @('-s')
  foreach ($header in $Headers) {
    if ($header) {
      $args += @('-H', $header)
    }
  }
  $args += $Url
  return (& curl.exe @args)
}

function Ensure-Status {
  param(
    [string]$Name,
    [int]$Actual,
    [int]$Expected
  )
  if ($Actual -ne $Expected) {
    Fail "$Name expected HTTP $Expected, got $Actual"
  }
  Write-Step "$Name -> HTTP $Actual"
}

function Ensure-True {
  param(
    [string]$Name,
    [bool]$Condition,
    [string]$ErrorMessage
  )
  if (-not $Condition) {
    Fail "$Name $ErrorMessage"
  }
  Write-Step "$Name -> OK"
}

function ConvertTo-Base64Url {
  param([byte[]]$Bytes)
  return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-ActorToken {
  param(
    [string]$ActorId,
    [string]$Secret,
    [int]$ExpiresInSeconds = 3600
  )

  $exp = [int]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + $ExpiresInSeconds)
  $payload = @{
    actorId = $ActorId
    exp = $exp
  } | ConvertTo-Json -Compress

  $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $payloadPart = ConvertTo-Base64Url -Bytes $payloadBytes

  $hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($Secret))
  try {
    $signatureBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($payloadPart))
  } finally {
    $hmac.Dispose()
  }

  $signaturePart = ConvertTo-Base64Url -Bytes $signatureBytes
  return "$payloadPart.$signaturePart"
}

$BaseUrl = $BaseUrl.TrimEnd('/')
if (-not $ManagerJwt) {
  $ManagerJwt = "$($env:MANAGER_JWT)".Trim()
}
if (-not $ActorTokenSecret) {
  $ActorTokenSecret = "$($env:PUBLIC_ACTOR_TOKEN_SECRET)".Trim()
}

$managerHeaders = @()
if ($ManagerJwt) {
  $managerHeaders = @("Authorization: Bearer $ManagerJwt")
}

Write-Step "Base URL: $BaseUrl"
Write-Step "Manager JWT checks: $(if ($ManagerJwt) { 'enabled' } else { 'skipped (MANAGER_JWT is empty)' })"
Write-Step "Actor token checks: $(if ($ActorTokenSecret) { 'enabled (env/arg secret found)' } else { 'skipped (PUBLIC_ACTOR_TOKEN_SECRET is empty)' })"

$roadmapResp = Invoke-JsonRequest -Method 'GET' -Url "$BaseUrl/api/public/roadmap"
Ensure-Status -Name 'GET /api/public/roadmap' -Actual $roadmapResp.StatusCode -Expected 200
Ensure-True -Name 'Roadmap payload' -Condition ($null -ne $roadmapResp.Json -and $null -ne $roadmapResp.Json.data) -ErrorMessage 'is missing data array'

$ideasResp = Invoke-JsonRequest -Method 'GET' -Url "$BaseUrl/api/public/ideas?sort=top"
Ensure-Status -Name 'GET /api/public/ideas?sort=top' -Actual $ideasResp.StatusCode -Expected 200
Ensure-True -Name 'Ideas payload' -Condition ($null -ne $ideasResp.Json -and $null -ne $ideasResp.Json.data) -ErrorMessage 'is missing data array'

$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$fingerprint = "smoke_$suffix"
$baselineActorId = "smoke_base_actor_$suffix"
$baselineActorHeaders = @("x-actor-id: $baselineActorId")
$ideaPayload = @{
  title = "Smoke idea $suffix"
  description = 'Smoke test idea created by scripts/smoke-check.ps1'
  userFingerprint = $fingerprint
} | ConvertTo-Json -Compress

$createIdeaResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas" -BodyJson $ideaPayload -Headers $baselineActorHeaders
Ensure-Status -Name 'POST /api/public/ideas' -Actual $createIdeaResp.StatusCode -Expected 201
Ensure-True -Name 'Created idea payload' -Condition ($null -ne $createIdeaResp.Json -and $null -ne $createIdeaResp.Json.data.id) -ErrorMessage 'does not include created idea id'

$ideaId = [int]$createIdeaResp.Json.data.id

$votePayload = @{ userFingerprint = $fingerprint } | ConvertTo-Json -Compress
$voteFirstResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas/$ideaId/vote" -BodyJson $votePayload -Headers $baselineActorHeaders
Ensure-Status -Name 'POST /api/public/ideas/:id/vote (first)' -Actual $voteFirstResp.StatusCode -Expected 201

$voteSecondResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas/$ideaId/vote" -BodyJson $votePayload -Headers $baselineActorHeaders
Ensure-Status -Name 'POST /api/public/ideas/:id/vote (duplicate)' -Actual $voteSecondResp.StatusCode -Expected 409
$conflictCode = $voteSecondResp.Json.error.code
Ensure-True -Name 'Duplicate vote error code' -Condition ($conflictCode -eq 'CONFLICT') -ErrorMessage "expected CONFLICT, got '$conflictCode'"

$commentPayload = @{
  text = "Smoke comment $suffix"
  userFingerprint = $fingerprint
} | ConvertTo-Json -Compress

$commentResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas/$ideaId/comments" -BodyJson $commentPayload -Headers $baselineActorHeaders
Ensure-Status -Name 'POST /api/public/ideas/:id/comments' -Actual $commentResp.StatusCode -Expected 201
Ensure-True -Name 'Created comment payload' -Condition ($null -ne $commentResp.Json -and $null -ne $commentResp.Json.data.id) -ErrorMessage 'does not include created comment id'

$commentId = [int]$commentResp.Json.data.id

$ideaDetailsResp = Invoke-JsonRequest -Method 'GET' -Url "$BaseUrl/api/public/ideas/$ideaId"
Ensure-Status -Name 'GET /api/public/ideas/:id' -Actual $ideaDetailsResp.StatusCode -Expected 200

$commentIds = @($ideaDetailsResp.Json.data.comments | ForEach-Object { $_.id })
$hasComment = $commentIds -contains $commentId
Ensure-True -Name 'Idea details comment visibility' -Condition $hasComment -ErrorMessage "does not include comment id=$commentId"

$actorId = "smoke_actor_$suffix"
$actorHeaders = @("x-actor-id: $actorId")

$actorIdeaPayload = @{
  title = "Smoke actor idea $suffix"
  description = 'Smoke test actor-based idea (no fingerprint in request body)'
} | ConvertTo-Json -Compress

$actorCreateIdeaResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas" -BodyJson $actorIdeaPayload -Headers $actorHeaders
Ensure-Status -Name 'POST /api/public/ideas (actor header only)' -Actual $actorCreateIdeaResp.StatusCode -Expected 201
Ensure-True -Name 'Created actor idea payload' -Condition ($null -ne $actorCreateIdeaResp.Json -and $null -ne $actorCreateIdeaResp.Json.data.id) -ErrorMessage 'does not include created actor idea id'

$actorIdeaId = [int]$actorCreateIdeaResp.Json.data.id

$actorVoteFirstResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas/$actorIdeaId/vote" -BodyJson '{}' -Headers $actorHeaders
Ensure-Status -Name 'POST /api/public/ideas/:id/vote (actor first)' -Actual $actorVoteFirstResp.StatusCode -Expected 201

$actorVoteSecondResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas/$actorIdeaId/vote" -BodyJson '{}' -Headers $actorHeaders
Ensure-Status -Name 'POST /api/public/ideas/:id/vote (actor duplicate)' -Actual $actorVoteSecondResp.StatusCode -Expected 409

$actorCommentPayload = @{
  text = "Smoke actor comment $suffix"
} | ConvertTo-Json -Compress

$actorCommentResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas/$actorIdeaId/comments" -BodyJson $actorCommentPayload -Headers $actorHeaders
Ensure-Status -Name 'POST /api/public/ideas/:id/comments (actor header only)' -Actual $actorCommentResp.StatusCode -Expected 201
Ensure-True -Name 'Created actor comment payload' -Condition ($null -ne $actorCommentResp.Json -and $null -ne $actorCommentResp.Json.data.id) -ErrorMessage 'does not include created actor comment id'

if ($ActorTokenSecret) {
  $tokenActorId = "smoke_token_$suffix"
  $validActorToken = New-ActorToken -ActorId $tokenActorId -Secret $ActorTokenSecret -ExpiresInSeconds 3600
  $tokenHeaders = @("x-actor-token: $validActorToken")

  $tokenIdeaPayload = @{
    title = "Smoke token idea $suffix"
    description = 'Smoke test token-based idea (no fingerprint in request body)'
  } | ConvertTo-Json -Compress

  $tokenCreateIdeaResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas" -BodyJson $tokenIdeaPayload -Headers $tokenHeaders
  Ensure-Status -Name 'POST /api/public/ideas (actor token only)' -Actual $tokenCreateIdeaResp.StatusCode -Expected 201
  Ensure-True -Name 'Created token idea payload' -Condition ($null -ne $tokenCreateIdeaResp.Json -and $null -ne $tokenCreateIdeaResp.Json.data.id) -ErrorMessage 'does not include created token idea id'

  $tokenIdeaId = [int]$tokenCreateIdeaResp.Json.data.id

  $tokenVoteFirstResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas/$tokenIdeaId/vote" -BodyJson '{}' -Headers $tokenHeaders
  Ensure-Status -Name 'POST /api/public/ideas/:id/vote (token first)' -Actual $tokenVoteFirstResp.StatusCode -Expected 201

  $tokenVoteSecondResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas/$tokenIdeaId/vote" -BodyJson '{}' -Headers $tokenHeaders
  Ensure-Status -Name 'POST /api/public/ideas/:id/vote (token duplicate)' -Actual $tokenVoteSecondResp.StatusCode -Expected 409
  Ensure-True -Name 'Token duplicate vote error code' -Condition ($tokenVoteSecondResp.Json.error.code -eq 'CONFLICT') -ErrorMessage "expected CONFLICT, got '$($tokenVoteSecondResp.Json.error.code)'"

  $tokenCommentPayload = @{
    text = "Smoke token comment $suffix"
  } | ConvertTo-Json -Compress

  $tokenCommentResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas/$tokenIdeaId/comments" -BodyJson $tokenCommentPayload -Headers $tokenHeaders
  Ensure-Status -Name 'POST /api/public/ideas/:id/comments (token only)' -Actual $tokenCommentResp.StatusCode -Expected 201
  Ensure-True -Name 'Created token comment payload' -Condition ($null -ne $tokenCommentResp.Json -and $null -ne $tokenCommentResp.Json.data.id) -ErrorMessage 'does not include created token comment id'

  $invalidTokenParts = $validActorToken.Split('.')
  $invalidActorToken = "$($invalidTokenParts[0]).invalid_signature"
  $invalidTokenHeaders = @("x-actor-token: $invalidActorToken")

  $invalidTokenVoteResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas/$tokenIdeaId/vote" -BodyJson '{}' -Headers $invalidTokenHeaders
  Ensure-Status -Name 'POST /api/public/ideas/:id/vote (invalid token)' -Actual $invalidTokenVoteResp.StatusCode -Expected 400
  Ensure-True -Name 'Invalid token error code' -Condition ($invalidTokenVoteResp.Json.error.code -eq 'VALIDATION_ERROR') -ErrorMessage "expected VALIDATION_ERROR, got '$($invalidTokenVoteResp.Json.error.code)'"

  $expiredActorToken = New-ActorToken -ActorId "smoke_token_exp_$suffix" -Secret $ActorTokenSecret -ExpiresInSeconds -60
  $expiredTokenHeaders = @("x-actor-token: $expiredActorToken")
  $expiredTokenIdeaResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/public/ideas" -BodyJson $tokenIdeaPayload -Headers $expiredTokenHeaders
  Ensure-Status -Name 'POST /api/public/ideas (expired token)' -Actual $expiredTokenIdeaResp.StatusCode -Expected 400
  Ensure-True -Name 'Expired token error code' -Condition ($expiredTokenIdeaResp.Json.error.code -eq 'VALIDATION_ERROR') -ErrorMessage "expected VALIDATION_ERROR, got '$($expiredTokenIdeaResp.Json.error.code)'"
}

$managerRoadmapUnauthorizedResp = Invoke-JsonRequest -Method 'GET' -Url "$BaseUrl/api/manager/roadmap"
Ensure-Status -Name 'GET /api/manager/roadmap (without auth)' -Actual $managerRoadmapUnauthorizedResp.StatusCode -Expected 401

if ($ManagerJwt) {
  $managerRoadmapListResp = Invoke-JsonRequest -Method 'GET' -Url "$BaseUrl/api/manager/roadmap" -Headers $managerHeaders
  Ensure-Status -Name 'GET /api/manager/roadmap (with JWT)' -Actual $managerRoadmapListResp.StatusCode -Expected 200
  Ensure-True -Name 'Manager roadmap payload' -Condition ($null -ne $managerRoadmapListResp.Json -and $null -ne $managerRoadmapListResp.Json.data) -ErrorMessage 'is missing data array'

  $managerRoadmapPayload = @{
    title = "Smoke roadmap $suffix"
    description = 'Smoke roadmap item created by scripts/smoke-check.ps1'
    status = 'planned'
    category = 'Smoke'
  } | ConvertTo-Json -Compress

  $managerRoadmapCreateResp = Invoke-JsonRequest -Method 'POST' -Url "$BaseUrl/api/manager/roadmap" -BodyJson $managerRoadmapPayload -Headers $managerHeaders
  Ensure-Status -Name 'POST /api/manager/roadmap' -Actual $managerRoadmapCreateResp.StatusCode -Expected 201
  Ensure-True -Name 'Created roadmap payload' -Condition ($null -ne $managerRoadmapCreateResp.Json -and $null -ne $managerRoadmapCreateResp.Json.data.id) -ErrorMessage 'does not include created roadmap id'

  $roadmapId = [int]$managerRoadmapCreateResp.Json.data.id

  $managerRoadmapUpdatePayload = @{
    title = "Smoke roadmap $suffix updated"
    description = 'Smoke roadmap updated by scripts/smoke-check.ps1'
    status = 'in_progress'
    category = 'Smoke'
  } | ConvertTo-Json -Compress

  $managerRoadmapUpdateResp = Invoke-JsonRequest -Method 'PUT' -Url "$BaseUrl/api/manager/roadmap/$roadmapId" -BodyJson $managerRoadmapUpdatePayload -Headers $managerHeaders
  Ensure-Status -Name 'PUT /api/manager/roadmap/:id' -Actual $managerRoadmapUpdateResp.StatusCode -Expected 200
  Ensure-True -Name 'Updated roadmap status' -Condition ($managerRoadmapUpdateResp.Json.data.status -eq 'in_progress') -ErrorMessage "expected in_progress, got '$($managerRoadmapUpdateResp.Json.data.status)'"

  $managerIdeasResp = Invoke-JsonRequest -Method 'GET' -Url "$BaseUrl/api/manager/ideas" -Headers $managerHeaders
  Ensure-Status -Name 'GET /api/manager/ideas' -Actual $managerIdeasResp.StatusCode -Expected 200
  Ensure-True -Name 'Manager ideas payload' -Condition ($null -ne $managerIdeasResp.Json -and $null -ne $managerIdeasResp.Json.data) -ErrorMessage 'is missing data array'

  $managerIdeaStatusPayload = @{ status = 'under_review' } | ConvertTo-Json -Compress
  $managerIdeaStatusResp = Invoke-JsonRequest -Method 'PATCH' -Url "$BaseUrl/api/manager/ideas/$ideaId/status" -BodyJson $managerIdeaStatusPayload -Headers $managerHeaders
  Ensure-Status -Name 'PATCH /api/manager/ideas/:id/status' -Actual $managerIdeaStatusResp.StatusCode -Expected 200
  Ensure-True -Name 'Updated idea status' -Condition ($managerIdeaStatusResp.Json.data.status -eq 'under_review') -ErrorMessage "expected under_review, got '$($managerIdeaStatusResp.Json.data.status)'"

  $managerCommentsResp = Invoke-JsonRequest -Method 'GET' -Url "$BaseUrl/api/manager/comments?target=idea&isHidden=false" -Headers $managerHeaders
  Ensure-Status -Name 'GET /api/manager/comments?target=idea&isHidden=false' -Actual $managerCommentsResp.StatusCode -Expected 200

  $managerCommentIds = @($managerCommentsResp.Json.data | ForEach-Object { $_.id })
  $hasManagerComment = $managerCommentIds -contains $commentId
  Ensure-True -Name 'Manager comments visibility' -Condition $hasManagerComment -ErrorMessage "does not include comment id=$commentId"

  $managerHideCommentPayload = @{ isHidden = $true } | ConvertTo-Json -Compress
  $managerHideCommentResp = Invoke-JsonRequest -Method 'PATCH' -Url "$BaseUrl/api/manager/comments/idea/$commentId/moderate" -BodyJson $managerHideCommentPayload -Headers $managerHeaders
  Ensure-Status -Name 'PATCH /api/manager/comments/idea/:id/moderate (hide)' -Actual $managerHideCommentResp.StatusCode -Expected 200
  Ensure-True -Name 'Hide comment result' -Condition ($managerHideCommentResp.Json.data.isHidden -eq $true) -ErrorMessage 'did not set isHidden=true'

  $managerUnhideCommentPayload = @{ isHidden = $false } | ConvertTo-Json -Compress
  $managerUnhideCommentResp = Invoke-JsonRequest -Method 'PATCH' -Url "$BaseUrl/api/manager/comments/idea/$commentId/moderate" -BodyJson $managerUnhideCommentPayload -Headers $managerHeaders
  Ensure-Status -Name 'PATCH /api/manager/comments/idea/:id/moderate (unhide)' -Actual $managerUnhideCommentResp.StatusCode -Expected 200
  Ensure-True -Name 'Unhide comment result' -Condition ($managerUnhideCommentResp.Json.data.isHidden -eq $false) -ErrorMessage 'did not set isHidden=false'

  $managerRoadmapDeleteResp = Invoke-JsonRequest -Method 'DELETE' -Url "$BaseUrl/api/manager/roadmap/$roadmapId" -Headers $managerHeaders
  Ensure-Status -Name 'DELETE /api/manager/roadmap/:id' -Actual $managerRoadmapDeleteResp.StatusCode -Expected 204
} else {
  Write-Step 'Manager API checks skipped (MANAGER_JWT is not provided).'
}

$embedJsStatus = Invoke-StatusOnly -Url "$BaseUrl/embed.js"
Ensure-Status -Name 'GET /embed.js' -Actual $embedJsStatus -Expected 200

$embedJsText = [string](Invoke-Text -Url "$BaseUrl/embed.js")
Ensure-True -Name 'embed.js content' -Condition ([bool]($embedJsText -match 'createElement\([''"]iframe[''"]\)')) -ErrorMessage 'does not contain iframe creation logic'

$embedDemoStatus = Invoke-StatusOnly -Url "$BaseUrl/embed-demo.html"
Ensure-Status -Name 'GET /embed-demo.html' -Actual $embedDemoStatus -Expected 200

$appStatus = Invoke-StatusOnly -Url "$BaseUrl/app/"
Ensure-Status -Name 'GET /app/' -Actual $appStatus -Expected 200

$appHtml = [string](Invoke-Text -Url "$BaseUrl/app/")
Ensure-True -Name 'App HTML base path' -Condition ([bool]($appHtml -match '/app/assets/')) -ErrorMessage 'does not include /app/assets/ paths'

$appDeepLinkStatus = Invoke-StatusOnly -Url "$BaseUrl/app/ideas/1"
Ensure-Status -Name 'GET /app/ideas/1 (SPA fallback)' -Actual $appDeepLinkStatus -Expected 200

if ($appHtml -match 'src="([^"]*assets[^"]*\.js)"') {
  $assetUrl = "$BaseUrl$($matches[1])"
  $assetStatus = Invoke-StatusOnly -Url $assetUrl
  Ensure-Status -Name "GET $($matches[1])" -Actual $assetStatus -Expected 200
} else {
  Fail 'Could not detect JS asset path in /app/ HTML'
}

Write-Host ''
Write-Host '[smoke] SUCCESS: public API + manager API + frontend + embed checks passed.'
