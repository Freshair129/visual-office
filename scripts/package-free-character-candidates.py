"""Closed, hashed local comparison package (not a game-dev admission receipt)."""
from pathlib import Path
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
DOWNLOADS=Path.home()/'Downloads/visual-office-character-candidates'
PACKAGE=ROOT/'.local/character-candidates';PACKAGE.mkdir(parents=True,exist_ok=True)
files={
    'sources/rain-v3-original.zip':DOWNLOADS/'rain-v3/source.zip',
    'sources/anime-original.blend':DOWNLOADS/'anime-girl/source.blend',
    'sources/anime-official.glb':DOWNLOADS/'anime-girl/source-gltf',
    'sources/anime-official-metadata.json':DOWNLOADS/'anime-girl/source-metadata.json',
    'sources/rain-license-readme.txt':ROOT/'reports/free-character-candidates/rain/ReadMe.txt.txt',
    'LICENSES.md':ROOT/'web/assets/models/characters/candidates/LICENSES.md',
    'TRIAL.md':ROOT/'docs/game-design/characters/2026-10-25-brand-study/FREE-MODEL-TRIAL.md',
    'prepare.py':ROOT/'scripts/blender/prepare-free-character.py',
}
for kind in ('anime','rain'):
    for suffix in ('.glb','.json'):files['runtime/'+kind+suffix]=ROOT/'web/assets/models/characters/candidates'/(kind+suffix)
    files['editable/'+kind+'-lab.blend']=ROOT/'assets-source/characters/candidates'/(kind+'-lab.blend')
    for name in ('roundtrip.json','raw-qa.json','front.png','quarter.png','profile.png','wire.png'):
        files['review/'+kind+'/'+name]=ROOT/'reports/free-character-candidates'/kind/name
roster=[{'path':name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for name,p in sorted(files.items())]
manifest={'schema':'visual-office-character-comparison/v1','scope':'Lab evaluation only','gameDevAdmission':False,'artApproved':False,'floorAdoption':False,'files':roster}
archive=PACKAGE/'free-character-comparison.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=1) as z:
    for name,p in files.items():z.write(p,name)
    z.writestr('manifest.json',json.dumps(manifest,indent=2))
with zipfile.ZipFile(archive) as z:
    assert set(z.namelist())=={r['path'] for r in roster}|{'manifest.json'}
    for row in roster:
        data=z.read(row['path']);assert len(data)==row['bytes'];assert hashlib.sha256(data).hexdigest()==row['sha256']
receipt={'archive':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'verifiedFiles':len(roster),'gameDevAdmission':False}
(PACKAGE/'receipt.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt,indent=2))
