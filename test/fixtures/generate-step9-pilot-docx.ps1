param(
  [string]$SourcePath = "$PSScriptRoot\step9-aircraft-lease.txt",
  [string]$OutputPath = "$PSScriptRoot\step9-aircraft-lease.docx"
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$paragraphs = Get-Content -Path $SourcePath
$body = ($paragraphs | ForEach-Object {
  $escaped = [System.Security.SecurityElement]::Escape($_)
  "<w:p><w:r><w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p>"
}) -join ""

$entries = [ordered]@{
  "[Content_Types].xml" = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
'@
  "_rels/.rels" = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@
  "word/document.xml" = "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><w:document xmlns:w=`"http://schemas.openxmlformats.org/wordprocessingml/2006/main`"><w:body>$body<w:sectPr/></w:body></w:document>"
}

$stream = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create)
try {
  $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
  try {
    foreach ($entryName in $entries.Keys) {
      $entry = $archive.CreateEntry($entryName)
      $writer = [System.IO.StreamWriter]::new($entry.Open(), [System.Text.UTF8Encoding]::new($false))
      try {
        $writer.Write($entries[$entryName])
      } finally {
        $writer.Dispose()
      }
    }
  } finally {
    $archive.Dispose()
  }
} finally {
  $stream.Dispose()
}

Write-Output $OutputPath