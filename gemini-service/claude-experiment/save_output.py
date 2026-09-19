"""
统一的输出保存工具：以后所有实验脚本生成的题目都存到 gemini-service/outputs/
目录下，不再只打印到终端就丢了。

Shared save helper: every experiment script's generated quiz gets written
to gemini-service/outputs/ instead of only being printed to the console.

命名规则 / Naming convention: `<序号>_<脚本名>_<材料名>.json`，序号从 00 开始
按已有文件数量自动递增，表示这是第几次跑出来的 quiz（不再用时间戳，方便一眼
看出顺序）。

    00_engaging_complete-induction-I.json
    01_standard_bounds.json
    ...
"""

import json
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "outputs"


def _next_seq() -> int:
    seq = 0
    for path in OUTPUT_DIR.glob("[0-9][0-9]_*"):
        try:
            seq = max(seq, int(path.name.split("_", 1)[0]) + 1)
        except ValueError:
            continue
    return seq


def save(script_name: str, pdf_name: str, data: dict) -> Path:
    """保存一次生成结果，文件名是 `<序号>_<脚本名>_<材料名>.json`。"""
    OUTPUT_DIR.mkdir(exist_ok=True)
    pdf_stem = Path(pdf_name).stem
    seq = _next_seq()
    path = OUTPUT_DIR / f"{seq:02d}_{script_name}_{pdf_stem}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
