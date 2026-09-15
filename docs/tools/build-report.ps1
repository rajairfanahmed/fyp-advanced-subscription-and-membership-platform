# Builds the FYP report .docx from docs/report-source.txt using Word automation.
# Line format (one token per line):
#   #TITLE#<chapter number>#<chapter name>   -> chapter title page, then page break
#   #ABSTRACT#                               -> centered "ABSTRACT" 16pt bold
#   #FRONT#<TEXT>                            -> centered 16pt bold caps heading (e.g. REFERENCES)
#   #H1#<text>   #H2#<text>   #H3#<text>     -> numbered headings 16/14/12 bold
#   #P#<text>                                -> justified body paragraph
#   #OBJ#<text>                              -> bulleted objective (only used in 1.2.2)
#   #FIGREF#<Figure 4.1: Name>               -> centered figure placeholder
#   #FCAP#<Figure 4.1: Name>                 -> figure caption below (Arial Narrow 10)
#   #TCAP#<Table 2.1: Name>                  -> table caption above (Arial Narrow 10)
#   #TABLE#  ... #ROW#a|b|c ... #ENDTABLE#   -> native Word table (first row = header)
#   #REF#<text>                              -> hanging reference entry
#   #PB#                                     -> page break

param(
  [string]$Source = "D:\Advanced Subscription and Membership Platform\docs\report-source.txt",
  [string]$Output = "D:\Advanced Subscription and Membership Platform\docs\Use This.docx"
)

$ErrorActionPreference = "Stop"
$lines = Get-Content -LiteralPath $Source -Encoding UTF8

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Add()

# ---- Page setup: A4, margins (top/bottom/right 1", left 1.25") ----
$ps = $doc.PageSetup
$ps.PageWidth  = $word.CentimetersToPoints(21.0)
$ps.PageHeight = $word.CentimetersToPoints(29.7)
$ps.TopMargin    = $word.InchesToPoints(1.0)
$ps.BottomMargin = $word.InchesToPoints(1.0)
$ps.RightMargin  = $word.InchesToPoints(1.0)
$ps.LeftMargin   = $word.InchesToPoints(1.25)

# ---- Normal style: Times New Roman 12, justified, 1.5 line ----
$normal = $doc.Styles.Item("Normal")
$normal.Font.Name = "Times New Roman"
$normal.Font.Size = 12
$normal.ParagraphFormat.Alignment = 3
$normal.ParagraphFormat.LineSpacingRule = 1
$normal.ParagraphFormat.SpaceAfter = 6

$sel = $word.Selection

function Reset-Font {
  $sel.Font.Name = "Times New Roman"
  $sel.Font.Bold = $false
  $sel.Font.Italic = $false
  $sel.Font.Size = 12
}

function Add-Para($text, $size, $bold, $align, $font, $italic) {
  $sel.ParagraphFormat.Alignment = $align
  $sel.Font.Name = $font
  $sel.Font.Size = $size
  $sel.Font.Bold = [int]$bold
  $sel.Font.Italic = [int]$italic
  $sel.TypeText($text)
  $sel.TypeParagraph()
  Reset-Font
}

$i = 0
while ($i -lt $lines.Count) {
  $line = $lines[$i]
  if ($line -match '^#([A-Z0-9]+)#?(.*)$') {
    $tok = $matches[1]
    $rest = $matches[2]
  } else {
    $i++; continue
  }

  switch ($tok) {
    "TITLE" {
      $parts = $rest -split '#', 2
      $sel.ParagraphFormat.SpaceBefore = 180
      Add-Para $parts[0] 18 $true 1 "Times New Roman" $false
      $sel.ParagraphFormat.SpaceBefore = 24
      Add-Para $parts[1] 22 $true 1 "Times New Roman" $false
      $sel.ParagraphFormat.SpaceBefore = 0
      $sel.InsertBreak(7)
    }
    "ABSTRACT" {
      Add-Para "ABSTRACT" 16 $true 1 "Times New Roman" $false
    }
    "FRONT" {
      $sel.InsertBreak(7)
      Add-Para $rest.ToUpper() 22 $true 1 "Times New Roman" $false
    }
    "H1" { Add-Para $rest 16 $true 0 "Times New Roman" $false }
    "H2" { Add-Para $rest 14 $true 0 "Times New Roman" $false }
    "H3" { Add-Para $rest 12 $true 0 "Times New Roman" $false }
    "P"  { Add-Para $rest 12 $false 3 "Times New Roman" $false }
    "OBJ" {
      $sel.Range.ListFormat.ApplyBulletDefault()
      Add-Para $rest 12 $false 0 "Times New Roman" $false
      $sel.Range.ListFormat.RemoveNumbers()
    }
    "FIGREF" { Add-Para ("[Insert " + $rest + " here]") 12 $false 1 "Times New Roman" $true }
    "FCAP"   { Add-Para $rest 10 $false 1 "Arial Narrow" $false }
    "TCAP"   { Add-Para $rest 10 $false 1 "Arial Narrow" $false }
    "REF"    {
      $sel.ParagraphFormat.LeftIndent = $word.InchesToPoints(0.5)
      $sel.ParagraphFormat.FirstLineIndent = $word.InchesToPoints(-0.5)
      Add-Para $rest 12 $false 3 "Times New Roman" $false
      $sel.ParagraphFormat.LeftIndent = 0
      $sel.ParagraphFormat.FirstLineIndent = 0
    }
    "PB" { $sel.InsertBreak(7) }
    "TABLE" {
      $rows = @()
      $i++
      while ($i -lt $lines.Count -and $lines[$i] -notmatch '^#ENDTABLE#?') {
        if ($lines[$i] -match '^#ROW#(.*)$') { $rows += ,($matches[1] -split '\|') }
        $i++
      }
      if ($rows.Count -gt 0) {
        $nCols = $rows[0].Count
        $tbl = $doc.Tables.Add($sel.Range, $rows.Count, $nCols)
        $tbl.Borders.Enable = $true
        $tbl.Range.Font.Name = "Times New Roman"
        $tbl.Range.Font.Size = 11
        for ($r = 0; $r -lt $rows.Count; $r++) {
          for ($c = 0; $c -lt $nCols; $c++) {
            $cellText = ""
            if ($c -lt $rows[$r].Count) { $cellText = $rows[$r][$c] }
            $cell = $tbl.Cell($r + 1, $c + 1)
            $cell.Range.Text = $cellText
            if ($r -eq 0) { $cell.Range.Font.Bold = $true }
          }
        }
        $sel.EndKey(6) | Out-Null
        $sel.MoveDown(5, 1) | Out-Null
        $doc.Content.InsertParagraphAfter()
        $sel.EndKey(6) | Out-Null
        Reset-Font
      }
    }
    default { }
  }
  $i++
}

if (Test-Path -LiteralPath $Output) { Remove-Item -LiteralPath $Output -Force }
# 16 = wdFormatDocumentDefault (.docx)
$doc.SaveAs([ref]$Output, [ref]16)
$doc.Close()
$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($sel) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
Write-Host "Built: $Output"
