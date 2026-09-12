$repo = Split-Path $PSScriptRoot -Parent
[xml]$graph = Get-Content (Join-Path $repo 'public/luigraph.svg') -Raw
$root = $graph.DocumentElement
$group = $root.FirstChild
$names = @('happy','sad','annoyed','scared')
$faces = @($group.ChildNodes | Where-Object { $_.Name -eq 'rect' -and $_.GetAttribute('width') -eq '80.5533' })
for ($i=0; $i -lt $faces.Count; $i++) {
  $face = $faces[$i]
  $copy = $graph.Clone()
  $copy.DocumentElement.SetAttribute('viewBox', "$($face.GetAttribute('x')) $($face.GetAttribute('y')) 80.5533 80.5533")
  $copy.DocumentElement.SetAttribute('width','80.5533')
  $copy.DocumentElement.SetAttribute('height','80.5533')
  $copyGroup = $copy.DocumentElement.FirstChild
  foreach ($child in @($copyGroup.ChildNodes)) { $null = $copyGroup.RemoveChild($child) }
  $null = $copyGroup.AppendChild($copy.ImportNode($face,$true))
  $copy.Save((Join-Path $repo "public/mood-$($names[$i]).svg"))
  $null = $group.RemoveChild($face)
}
$graph.Save((Join-Path $repo 'public/luigraph-live.svg'))
