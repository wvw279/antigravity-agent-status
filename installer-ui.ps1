Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PayloadDir = Join-Path $ScriptDir 'payload'
$InstallScript = Join-Path $ScriptDir 'install.mjs'
$UninstallScript = Join-Path $ScriptDir 'uninstall.mjs'
$Version = 'v1.5.1'

function Find-NodeExe {
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd -and (Test-Path $cmd.Source)) { return $cmd.Source }
    $candidates = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
        "$env:ProgramFiles(x86)\nodejs\node.exe"
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    return $null
}

function Find-AntigravityExe {
    $proc = Get-Process -Name 'Antigravity' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($proc) {
        try {
            if ($proc.Path -and (Test-Path $proc.Path)) { return $proc.Path }
        } catch {}
    }
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Antigravity\Antigravity.exe",
        "$env:LOCALAPPDATA\Antigravity\Antigravity.exe",
        "$env:ProgramFiles\Antigravity\Antigravity.exe",
        "$env:ProgramFiles(x86)\Antigravity\Antigravity.exe"
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    # Поиск по ярлыкам в меню Пуск и на Рабочем столе
    try {
        $wsh = New-Object -ComObject WScript.Shell
        $lnkDirs = @(
            [Environment]::GetFolderPath('Desktop'),
            [Environment]::GetFolderPath('Programs'),
            [Environment]::GetFolderPath('CommonPrograms')
        )
        foreach ($d in $lnkDirs) {
            if ($d -and (Test-Path $d)) {
                $lnks = Get-ChildItem -Path $d -Filter '*Antigravity*.lnk' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 3
                foreach ($l in $lnks) {
                    $target = $wsh.CreateShortcut($l.FullName).TargetPath
                    if ($target -and (Test-Path $target) -and $target.ToLower().EndsWith('antigravity.exe')) {
                        return $target
                    }
                }
            }
        }
    } catch {}
    return $null
}

function Resolve-AsarFromExe($exePath) {
    if (-not $exePath) { return $null }
    $dir = Split-Path -Parent $exePath
    $asar = Join-Path $dir 'resources\app.asar'
    if (Test-Path $asar) { return $asar }
    return $null
}

# Цвета в стиле Antigravity
$BgDark    = [System.Drawing.Color]::FromArgb(17, 17, 20)
$BgPanel   = [System.Drawing.Color]::FromArgb(26, 26, 31)
$BgLog     = [System.Drawing.Color]::FromArgb(12, 12, 15)
$FgText    = [System.Drawing.Color]::FromArgb(236, 236, 241)
$FgMuted   = [System.Drawing.Color]::FromArgb(156, 157, 168)
$Accent    = [System.Drawing.Color]::FromArgb(217, 138, 60)
$DangerBg  = [System.Drawing.Color]::FromArgb(46, 30, 32)
$DangerFg  = [System.Drawing.Color]::FromArgb(248, 160, 160)
$GreenFg   = [System.Drawing.Color]::FromArgb(110, 224, 138)

$form = New-Object System.Windows.Forms.Form
$form.Text = "Статус агента ($Version) — Установщик для Antigravity"
$form.Size = New-Object System.Drawing.Size(580, 470)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.BackColor = $BgDark
$form.ForeColor = $FgText
$form.Font = New-Object System.Drawing.Font('Segoe UI', 9.5)

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "Панель «Статус агента» $Version"
$lblTitle.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = $FgText
$lblTitle.Location = New-Object System.Drawing.Point(22, 16)
$lblTitle.AutoSize = $true
$form.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text = "Автономная установка: 5 пресетов + свои пресеты с сохранением + перетаскивание язычка"
$lblSub.ForeColor = $FgMuted
$lblSub.Location = New-Object System.Drawing.Point(23, 46)
$lblSub.Size = New-Object System.Drawing.Size(530, 20)
$form.Controls.Add($lblSub)

# Статус-блок (Antigravity + Node.js)
$infoPanel = New-Object System.Windows.Forms.Panel
$infoPanel.BackColor = $BgPanel
$infoPanel.Location = New-Object System.Drawing.Point(22, 76)
$infoPanel.Size = New-Object System.Drawing.Size(520, 74)
$form.Controls.Add($infoPanel)

$lblAg = New-Object System.Windows.Forms.Label
$lblAg.Location = New-Object System.Drawing.Point(12, 12)
$lblAg.Size = New-Object System.Drawing.Size(400, 20)
$infoPanel.Controls.Add($lblAg)

$btnBrowseAg = New-Object System.Windows.Forms.Button
$btnBrowseAg.Text = "Выбрать..."
$btnBrowseAg.Location = New-Object System.Drawing.Point(422, 8)
$btnBrowseAg.Size = New-Object System.Drawing.Size(86, 26)
$btnBrowseAg.FlatStyle = 'Flat'
$btnBrowseAg.BackColor = [System.Drawing.Color]::FromArgb(40, 40, 48)
$btnBrowseAg.ForeColor = $FgText
$btnBrowseAg.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(70, 70, 82)
$infoPanel.Controls.Add($btnBrowseAg)

$lblNode = New-Object System.Windows.Forms.Label
$lblNode.Location = New-Object System.Drawing.Point(12, 42)
$lblNode.Size = New-Object System.Drawing.Size(375, 20)
$infoPanel.Controls.Add($lblNode)

$btnGetNode = New-Object System.Windows.Forms.Button
$btnGetNode.Text = "Скачать Node.js"
$btnGetNode.Location = New-Object System.Drawing.Point(392, 38)
$btnGetNode.Size = New-Object System.Drawing.Size(116, 26)
$btnGetNode.FlatStyle = 'Flat'
$btnGetNode.BackColor = [System.Drawing.Color]::FromArgb(40, 40, 48)
$btnGetNode.ForeColor = $Accent
$btnGetNode.FlatAppearance.BorderColor = $Accent
$btnGetNode.Visible = $false
$btnGetNode.Add_Click({ Start-Process 'https://nodejs.org/' })
$infoPanel.Controls.Add($btnGetNode)

# Чекбокс авто-перезапуска Antigravity
$chkAutoRestart = New-Object System.Windows.Forms.CheckBox
$chkAutoRestart.Text = "Автоматически закрыть Antigravity перед установкой и открыть снова после неё"
$chkAutoRestart.Checked = $true
$chkAutoRestart.ForeColor = $FgText
$chkAutoRestart.Location = New-Object System.Drawing.Point(24, 160)
$chkAutoRestart.Size = New-Object System.Drawing.Size(520, 22)
$form.Controls.Add($chkAutoRestart)

# Лог
$txtLog = New-Object System.Windows.Forms.TextBox
$txtLog.Multiline = $true
$txtLog.ReadOnly = $true
$txtLog.ScrollBars = 'Vertical'
$txtLog.BackColor = $BgLog
$txtLog.ForeColor = [System.Drawing.Color]::FromArgb(205, 208, 220)
$txtLog.Font = New-Object System.Drawing.Font('Consolas', 9)
$txtLog.BorderStyle = 'FixedSingle'
$txtLog.Location = New-Object System.Drawing.Point(22, 192)
$txtLog.Size = New-Object System.Drawing.Size(520, 174)
$form.Controls.Add($txtLog)

# Кнопки действий
$btnInstall = New-Object System.Windows.Forms.Button
$btnInstall.Text = "Установить / Обновить"
$btnInstall.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$btnInstall.Location = New-Object System.Drawing.Point(22, 380)
$btnInstall.Size = New-Object System.Drawing.Size(260, 38)
$btnInstall.FlatStyle = 'Flat'
$btnInstall.BackColor = $Accent
$btnInstall.ForeColor = [System.Drawing.Color]::FromArgb(17, 17, 20)
$btnInstall.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnInstall)

$btnUninstall = New-Object System.Windows.Forms.Button
$btnUninstall.Text = "Удалить плагин"
$btnUninstall.Location = New-Object System.Drawing.Point(294, 380)
$btnUninstall.Size = New-Object System.Drawing.Size(136, 38)
$btnUninstall.FlatStyle = 'Flat'
$btnUninstall.BackColor = $DangerBg
$btnUninstall.ForeColor = $DangerFg
$btnUninstall.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(110, 50, 54)
$form.Controls.Add($btnUninstall)

$btnClose = New-Object System.Windows.Forms.Button
$btnClose.Text = "Закрыть"
$btnClose.Location = New-Object System.Drawing.Point(442, 380)
$btnClose.Size = New-Object System.Drawing.Size(100, 38)
$btnClose.FlatStyle = 'Flat'
$btnClose.BackColor = $BgPanel
$btnClose.ForeColor = $FgText
$btnClose.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(65, 65, 76)
$btnClose.Add_Click({ $form.Close() })
$form.Controls.Add($btnClose)

$script:NodeExe = $null
$script:AgExe = $null
$script:AsarPath = $null

function Append-Log($msg) {
    $txtLog.AppendText("$msg`r`n")
    $txtLog.SelectionStart = $txtLog.Text.Length
    $txtLog.ScrollToCaret()
    [System.Windows.Forms.Application]::DoEvents()
}

function Refresh-Environment {
    $script:NodeExe = Find-NodeExe
    if (-not $script:AgExe) { $script:AgExe = Find-AntigravityExe }
    $script:AsarPath = Resolve-AsarFromExe $script:AgExe

    if ($script:AsarPath) {
        $lblAg.Text = "Antigravity: найден (" + (Split-Path -Parent $script:AgExe) + ")"
        $lblAg.ForeColor = $GreenFg
    } else {
        $lblAg.Text = "Antigravity: не найден — нажмите «Выбрать...» и укажите Antigravity.exe"
        $lblAg.ForeColor = $DangerFg
    }

    if ($script:NodeExe) {
        $lblNode.Text = "Node.js: найден ($($script:NodeExe))"
        $lblNode.ForeColor = $GreenFg
        $btnGetNode.Visible = $false
    } else {
        $lblNode.Text = "Node.js: не найден! Установите Node.js LTS и перезапустите установщик."
        $lblNode.ForeColor = $DangerFg
        $btnGetNode.Visible = $true
    }

    $hasPayload = (Test-Path $PayloadDir) -and (Test-Path $InstallScript)
    if (-not $hasPayload) {
        $txtLog.Text = ""
        Append-Log "[ОШИБКА] Вы запустили установщик прямо из ZIP-архива!"
        Append-Log "Пожалуйста, сначала РАСПАКУЙТЕ весь архив в обычную папку (правой кнопкой -> Извлечь все), а затем запустите УСТАНОВИТЬ.bat."
        $btnInstall.Enabled = $false
        $btnUninstall.Enabled = $false
    } else {
        $btnInstall.Enabled = ($null -ne $script:NodeExe) -and ($null -ne $script:AsarPath)
        $btnUninstall.Enabled = ($null -ne $script:NodeExe)
    }
}

$btnBrowseAg.Add_Click({
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Title = "Выберите Antigravity.exe"
    $dlg.Filter = "Antigravity (Antigravity.exe)|Antigravity.exe|Все исполняемые (*.exe)|*.exe"
    if ($dlg.ShowDialog() -eq 'OK') {
        $script:AgExe = $dlg.FileName
        Refresh-Environment
    }
})

function Run-NodeScript($scriptPath, $actionLabel) {
    $btnInstall.Enabled = $false
    $btnUninstall.Enabled = $false
    $txtLog.Text = ""
    Append-Log ">>> $actionLabel..."

    $wasRunning = @(Get-Process -Name 'Antigravity' -ErrorAction SilentlyContinue).Count -gt 0
    if ($wasRunning) {
        if ($chkAutoRestart.Checked) {
            Append-Log "Закрываю Antigravity, чтобы освободить app.asar..."
            Get-Process -Name 'Antigravity' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 1200
        } else {
            Append-Log "[ВНИМАНИЕ] Antigravity сейчас запущен — если файл app.asar заблокирован, закройте программу."
        }
    }

    $nodeDir = Split-Path -Parent $script:NodeExe
    $env:PATH = "$nodeDir;$env:PATH"

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $script:NodeExe
    $argStr = '"' + $scriptPath + '"'
    if ($script:AsarPath) { $argStr += ' "--asar=' + $script:AsarPath + '"' }
    $psi.Arguments = $argStr
    $psi.WorkingDirectory = $ScriptDir
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi
    $p.Start() | Out-Null

    while (-not $p.HasExited) {
        while ($null -ne ($line = $p.StandardOutput.ReadLine())) { Append-Log $line }
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 40
    }
    $remOut = $p.StandardOutput.ReadToEnd()
    if ($remOut) { Append-Log $remOut.TrimEnd() }
    $remErr = $p.StandardError.ReadToEnd()
    if ($remErr) { Append-Log $remErr.TrimEnd() }

    $code = $p.ExitCode
    if ($code -eq 0) {
        Append-Log ""
        Append-Log "=========================================="
        Append-Log "  УСПЕШНО ЗАВЕРШЕНО!"
        Append-Log "=========================================="
        if ($chkAutoRestart.Checked -and $script:AgExe -and (Test-Path $script:AgExe)) {
            Append-Log "Запускаю Antigravity..."
            Start-Process -FilePath $script:AgExe
        }
        [System.Windows.Forms.MessageBox]::Show(
            "Готово! Панель «Статус агента» ($Version) установлена.`n`nЕсли Antigravity не открылся сам — просто запустите его, и справа появится панель.",
            "Статус агента",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
    } else {
        Append-Log ""
        Append-Log "[ОШИБКА] Завершено с кодом $code."
        [System.Windows.Forms.MessageBox]::Show(
            "Возникла ошибка (код $code). Подробности указаны в окне лога.",
            "Ошибка установки",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    }

    Refresh-Environment
}

$btnInstall.Add_Click({ Run-NodeScript $InstallScript "Установка «Статус агента» $Version" })
$btnUninstall.Add_Click({ Run-NodeScript $UninstallScript "Удаление «Статус агента»" })

Refresh-Environment
if ((Test-Path $PayloadDir) -and (Test-Path $InstallScript)) {
    Append-Log "Готов к установке «Статус агента» ($Version)."
    Append-Log "Нажмите «Установить / Обновить» — установщик сам всё настроит и перезапустит Antigravity."
}

[void]$form.ShowDialog()
