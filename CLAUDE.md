# Soquizzer 项目协作规范 / Project Collaboration Guide

## Git 工作流 / Git Workflow

**标准流程：先 pull，再开分支，改完 merge 回 main，最后再 push。**
**Standard flow: pull first, branch off, merge back into `main`, then push.**

1. **开始任何工作前先同步 / Sync before starting any work**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **任何较大的改动都要新开一个分支 / Any non-trivial change gets its own branch**
   - 不要直接在 `main` 上开发或直接 push 到 `main`。
     Never commit directly to `main` or push straight to it.
   - 分支命名建议：`feature/xxx`、`fix/xxx`、`backend-xxx` 之类，
     说明这个分支是干什么的。
     Suggested naming: `feature/xxx`, `fix/xxx`, `backend-xxx` — something
     that describes what the branch is for.
   ```bash
   git checkout -b feature/your-change-name
   ```

3. **改完之后，先同步最新的 main，再合并 / Before merging, sync with the latest main**
   - 因为团队有 4 个人同时在改，`main` 上大概率已经有新提交了。
     With 4 people working in parallel, `main` will very likely have moved.
   ```bash
   git checkout main && git pull origin main
   git checkout feature/your-change-name
   git rebase main   # 或者 git merge main，处理冲突 / or `git merge main`, resolve conflicts if any
   ```

4. **push 分支并开 PR，走 review/merge 流程 / Push the branch and open a PR**
   ```bash
   git push -u origin feature/your-change-name
   gh pr create --fill
   ```
   - 合并方式用 PR merge（GitHub 上点 merge，或 `gh pr merge`），
     不要直接 `git push origin main`。
     Merge via a PR (on GitHub, or `gh pr merge`) — do not `git push origin main` directly.

5. **合并后清理分支、同步本地 main / After merging, clean up and re-sync**
   ```bash
   git checkout main
   git pull origin main
   git branch -d feature/your-change-name
   ```

对于零碎的小改动（比如改一个 typo）可以灵活处理，但只要是一次完整功能/模块的
提交，都请走上面这套流程，避免多人同时改 `main` 造成冲突或互相覆盖。
Small, trivial fixes (e.g. a typo) can be more casual, but any complete
feature/module change should follow this flow to avoid conflicts or
overwrites from 4 people editing `main` at the same time.

## 项目结构 / Project Structure

- `backend/` — Java (Spring) 后端服务 / Java (Spring) backend service
- `frontend/` — 前端 (Vite + React + Electron)，`npm` 命令都在这个目录下运行 /
  frontend (Vite + React + Electron); run `npm` commands from inside this
  directory
- `gemini-service/` — Gemini API IO 模块的 Python 最小示例，独立成自己的
  目录（详见根目录 README）。/ Python minimal example for the Gemini API
  IO module, kept in its own directory (see the root README for details).

如果 Python 的 Gemini 模块之后要和 Java 后端集成，建议在 PR 里讨论清楚
调用方式（比如 Python 起一个独立服务被 Java 调用，还是把逻辑用 Java 重写），
避免后期返工。
If the Python Gemini module needs to integrate with the Java backend
later, discuss the integration approach in a PR (e.g. Python as a
separate service called by Java, vs. porting the logic to Java) to avoid
rework.
