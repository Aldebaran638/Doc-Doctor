# Git实验快速操作指南

## 前置准备
确保项目目录：`d:\Coding\Doc-Doctor`

---

## 步骤1：初始化仓库并提交（5分钟）

```bash
cd d:\Coding\Doc-Doctor
git init
git add .
git commit -m "初始提交：Doc-Doctor项目"
git log --oneline
```

**截图点**：
- `git status` 显示所有文件已添加
- `git log --oneline` 显示提交记录

---

## 步骤2：创建分支并修改文件（5分钟）

```bash
# 创建并切换到新分支
git checkout -b feature-接口文档优化

# 修改接口文档.md（随便加一行注释或内容）
# 然后提交
git add 接口文档.md
git commit -m "优化接口文档"

# 查看差异
git diff main..feature-接口文档优化

# 查看分支
git branch
```

**截图点**：
- `git branch` 显示分支列表
- `git diff` 显示文件差异
- 修改后的文件内容

---

## 步骤3：合并分支（2分钟）

```bash
# 切换回主分支
git checkout main

# 合并分支
git merge feature-接口文档优化

# 查看合并图
git log --oneline --graph --all

# 删除已合并的分支（可选）
git branch -d feature-接口文档优化
```

**截图点**：
- `git merge` 的合并信息
- `git log --graph` 显示分支合并图

---

## 步骤4：创建远程仓库并推送（5分钟）

### 方案A：使用Gitee（推荐，国内快）

1. 访问 https://gitee.com 注册/登录
2. 点击"新建仓库"，仓库名：`Doc-Doctor`，选择"公开"
3. 创建后复制仓库地址（如：`https://gitee.com/你的用户名/Doc-Doctor.git`）

```bash
# 添加远程仓库
git remote add origin https://gitee.com/你的用户名/Doc-Doctor.git

# 推送代码
git push -u origin main

# 查看远程仓库
git remote -v
```

### 方案B：使用GitHub

1. 访问 https://github.com 注册/登录
2. 点击"New repository"，仓库名：`Doc-Doctor`，选择"Public"
3. 创建后复制仓库地址

```bash
git remote add origin https://github.com/你的用户名/Doc-Doctor.git
git push -u origin main
git remote -v
```

**截图点**：
- `git remote -v` 显示远程仓库
- 远程仓库网页界面
- `git push` 成功输出

---

## 步骤5：模拟冲突解决（10分钟）

### 方法：用两个不同的目录模拟两个开发者

```bash
# 在项目目录执行
cd d:\Coding\Doc-Doctor

# 创建第二个工作目录（模拟另一个开发者）
cd d:\Coding
git clone https://gitee.com/你的用户名/Doc-Doctor.git Doc-Doctor-Developer2
cd Doc-Doctor-Developer2

# 修改接口文档.md（在Developer2目录）
# 比如在文件末尾添加一行："开发者2的修改"
# 然后提交并推送
git add 接口文档.md
git commit -m "开发者2：更新接口文档"
git push origin main

# 回到第一个目录
cd d:\Coding\Doc-Doctor

# 修改同一个文件的同一行（制造冲突）
# 比如也在文件末尾添加："开发者1的修改"
git add 接口文档.md
git commit -m "开发者1：更新接口文档"

# 尝试推送（会失败，需要先拉取）
git push origin main

# 拉取远程更改（会产生冲突）
git pull origin main

# 解决冲突：打开接口文档.md，会看到冲突标记
# <<<<<<< HEAD
# 开发者1的修改
# =======
# 开发者2的修改
# >>>>>>> origin/main

# 手动编辑，保留两行或合并，删除冲突标记
# 然后：
git add 接口文档.md
git commit -m "解决冲突：合并开发者1和2的修改"
git push origin main
```

**截图点**：
- 冲突文件内容（显示 `<<<<<<<` 标记）
- `git status` 显示冲突状态
- 解决后的文件内容
- `git push` 成功

---

## 步骤6：标签操作（5分钟）

```bash
cd d:\Coding\Doc-Doctor

# 创建轻量标签
git tag v1.0.0

# 创建带注释的标签
git tag -a v1.0.1 -m "版本1.0.1：完成基础功能"

# 查看所有标签
git tag

# 查看标签详情
git show v1.0.1

# 推送标签到远程
git push origin v1.0.0
git push origin v1.0.1
# 或一次性推送所有标签
git push origin --tags

# 删除本地标签
git tag -d v1.0.0

# 删除远程标签
git push origin --delete v1.0.0

# 验证删除
git tag
```

**截图点**：
- `git tag` 显示标签列表
- `git show v1.0.1` 显示标签详情
- 远程仓库的标签页面
- 删除前后的对比

---

## 实验报告快速模板

### 一、实验目的与要求
（直接复制题目要求）

### 二、实验环境
- 操作系统：Windows 10
- Git版本：`git --version` 的输出
- 项目：Doc-Doctor（代码注释检查工具）

### 三、实验步骤与结果

#### 3.1 创建本地代码仓库
**操作步骤**：
1. 初始化Git仓库
2. 添加项目文件
3. 提交到本地库

**关键命令**：
```bash
git init
git add .
git commit -m "初始提交"
```

**截图**：[粘贴 `git log --oneline` 的截图]

---

#### 3.2 创建分支并提交修改
**操作步骤**：
1. 创建功能分支
2. 修改文件并提交
3. 对比文件差异

**关键命令**：
```bash
git checkout -b feature-接口文档优化
# 修改文件...
git commit -m "优化接口文档"
git diff main..feature-接口文档优化
```

**截图**：[粘贴分支列表和文件差异的截图]

---

#### 3.3 合并分支
**操作步骤**：
1. 切换回主分支
2. 合并功能分支
3. 查看合并历史

**关键命令**：
```bash
git checkout main
git merge feature-接口文档优化
git log --graph --oneline
```

**截图**：[粘贴合并图和提交历史的截图]

---

#### 3.4 多人协作（远程仓库）
**操作步骤**：
1. 创建远程仓库（Gitee/GitHub）
2. 添加远程仓库地址
3. 推送代码到远程

**关键命令**：
```bash
git remote add origin [仓库地址]
git push -u origin main
```

**截图**：[粘贴远程仓库网页界面和推送成功的截图]

---

#### 3.5 冲突解决
**操作步骤**：
1. 模拟两个开发者修改同一文件
2. 拉取远程更改产生冲突
3. 手动解决冲突并提交

**关键命令**：
```bash
git pull origin main
# 解决冲突...
git add [冲突文件]
git commit -m "解决冲突"
git push origin main
```

**截图**：
- 冲突文件内容（显示冲突标记）
- 解决后的文件
- 推送成功的提示

---

#### 3.6 标签操作
**操作步骤**：
1. 创建本地标签
2. 推送标签到远程
3. 查看和删除标签

**关键命令**：
```bash
git tag -a v1.0.1 -m "版本说明"
git push origin v1.0.1
git tag -d v1.0.0
git push origin --delete v1.0.0
```

**截图**：
- 标签列表
- 远程仓库标签页面
- 删除前后的对比

---

### 四、实验总结
1. **收获**：掌握了Git分支、合并、远程协作、冲突解决和标签管理
2. **问题**：在冲突解决时需要注意仔细检查合并内容
3. **体会**：Git是团队协作的重要工具，版本控制对项目管理至关重要

---

## 快速完成时间表

- 步骤1-3：12分钟
- 步骤4：5分钟（注册账号可能需要额外时间）
- 步骤5：10分钟
- 步骤6：5分钟
- 写报告：20-30分钟

**总计：约1小时**

---

## 注意事项

1. **冲突模拟**：如果时间紧张，步骤5可以简化，只展示冲突文件内容和解决过程
2. **截图工具**：Windows可以用 `Win + Shift + S` 快速截图
3. **命令复制**：可以直接复制命令到PowerShell执行
4. **远程仓库**：Gitee比GitHub在国内访问更快，推荐使用
