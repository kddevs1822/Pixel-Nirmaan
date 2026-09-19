import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class FolderPickerService {
  public static selectFolder(): Promise<string | null> {
    return new Promise((resolve) => {
      if (os.platform() === 'win32') {
        const tempPs1 = path.join(os.tmpdir(), `select_folder_modern_${Date.now()}.ps1`);
        
        let logoPath = path.resolve(process.cwd(), 'frontend/public/logo.jpg');
        if (!fs.existsSync(logoPath)) {
          logoPath = path.resolve(process.cwd(), '../frontend/public/logo.jpg');
        }
        const safeLogoPath = fs.existsSync(logoPath) ? logoPath.replace(/\\/g, '\\\\') : '';

        const psContent = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$logoPath = "${safeLogoPath}"

$owner = New-Object System.Windows.Forms.Form
$owner.Width = 0
$owner.Height = 0
$owner.ShowInTaskbar = $false
$owner.StartPosition = 'Manual'
$owner.Location = New-Object System.Drawing.Point(-2000, -2000)

if ($logoPath -and (Test-Path $logoPath)) {
    try {
        $bmp = [System.Drawing.Bitmap]::FromFile($logoPath)
        $hIcon = $bmp.GetHicon()
        $icon = [System.Drawing.Icon]::FromHandle($hIcon)
        $owner.Icon = $icon
    } catch {}
}

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = "Select Export Directory"
$dialog.Filter = "Folders|*.none"
$dialog.CheckFileExists = $false
$dialog.CheckPathExists = $true
$dialog.ValidateNames = $false
$dialog.FileName = "Select Folder"

$owner.Show()
$result = $dialog.ShowDialog($owner)
$owner.Close()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    $folder = [System.IO.Path]::GetDirectoryName($dialog.FileName)
    if ($folder) {
        Write-Output $folder
    }
}
`;
        try {
          fs.writeFileSync(tempPs1, psContent, 'utf-8');
          exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs1}"`, (err, stdout) => {
            try {
              if (fs.existsSync(tempPs1)) {
                fs.unlinkSync(tempPs1);
              }
            } catch (e) {}

            if (err || !stdout.trim()) {
              resolve(null);
            } else {
              resolve(stdout.trim());
            }
          });
        } catch (e) {
          console.error("Error launching folder picker:", e);
          resolve(null);
        }
      } else if (os.platform() === 'darwin') {
        const cmd = `osascript -e 'POSIX path of (choose folder with prompt "Select Output Directory for PixelNirmaan")'`;
        exec(cmd, (err, stdout) => {
          if (err || !stdout.trim()) {
            resolve(null);
          } else {
            resolve(stdout.trim());
          }
        });
      } else {
        const cmd = `zenity --file-selection --directory 2>/dev/null || kdialog --getexistingdirectory 2>/dev/null`;
        exec(cmd, (err, stdout) => {
          if (err || !stdout.trim()) {
            resolve(null);
          } else {
            resolve(stdout.trim());
          }
        });
      }
    });
  }
}

