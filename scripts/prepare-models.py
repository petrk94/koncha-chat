#!/usr/bin/env python3
"""Provision opt-in self-hosted OPUS-MT ONNX model assets. Never uploads chat content."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from huggingface_hub import HfApi, snapshot_download

MODEL = {
    'ja-en': ('Xenova/opus-mt-ja-en', 'Helsinki-NLP/opus-mt-ja-en', 'Apache-2.0'),
    'en-ja': ('Xenova/opus-mt-en-jap', 'Helsinki-NLP/opus-mt-en-jap', 'Apache-2.0'),
    'de-en': ('Xenova/opus-mt-de-en', 'Helsinki-NLP/opus-mt-de-en', 'Apache-2.0'),
    'en-de': ('Xenova/opus-mt-en-de', 'Helsinki-NLP/opus-mt-en-de', 'CC-BY-4.0'),
}
parser = argparse.ArgumentParser(description='Downloads large model WEIGHTS to your server build directory (not Git-tracked).')
parser.add_argument('pairs', nargs='+', choices=sorted(MODEL))
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
base = root / 'public' / 'models'
manifest = base / 'manifest.json'
manifest_data = {'schema': 1, 'pairs': {}}
if manifest.exists():
    manifest_data = json.loads(manifest.read_text())
api = HfApi()
for pair in dict.fromkeys(args.pairs):
    repo, original, license_name = MODEL[pair]
    print(f'Provisioning {pair}: {repo} (source: {original}; license: {license_name})')
    # A frozen revision is used, not moving 'main'.
    sha = api.model_info(repo).sha
    target = base / repo
    snapshot_download(
        repo_id=repo, revision=sha, local_dir=target,
        allow_patterns=['*.json', '*.spm', '*.model', '*.txt', 'onnx/*_quantized.onnx'],
    )
    assets = {}
    for path in sorted(target.rglob('*')):
        if not path.is_file() or '.cache' in path.parts: continue
        with path.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        assets[str(path.relative_to(target))] = digest
    if not any(name.startswith('onnx/') and name.endswith('_quantized.onnx') for name in assets):
        raise RuntimeError(f'Quantized ONNX weights absent for {pair}; check the upstream model layout')
    manifest_data['pairs'][pair] = {'repo': repo, 'original': original, 'revision': sha, 'license': license_name, 'sha256': assets}
    base.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(manifest_data, indent=2, ensure_ascii=False) + '\n')
    print(f'Files: {len(assets)}. Recorded revision {sha}')
print('Done. Serve /models/ and /vendor/ via HTTPS from the SAME origin; never git add these weight directories.')
