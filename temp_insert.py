from pathlib import Path
path = Path('docs/plannerGuide.md')
text = path.read_text(encoding='utf-8')
marker =  \n---\n\n## Quick Reference Commands
parts = [
