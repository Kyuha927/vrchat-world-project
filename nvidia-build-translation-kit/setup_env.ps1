param(
    [string]$ApiKey
)

if (-not $ApiKey) {
    $secure = Read-Host "NVIDIA_API_KEY" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $ApiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        if ($bstr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    }
}

if (-not $ApiKey -or $ApiKey.Trim().Length -lt 10) {
    throw "API key is empty or too short."
}

[Environment]::SetEnvironmentVariable("NVIDIA_API_KEY", $ApiKey.Trim(), "User")
Write-Host "Saved NVIDIA_API_KEY to the current Windows user environment."
Write-Host "Open a new terminal, then run: python .\scripts\check_nvidia_build.py"
