(function () {
  const vscode = acquireVsCodeApi();
  const btn = document.getElementById('run-check');
  const btnProjectCheck = document.getElementById('run-project-check');
  const btnCancelCheck = document.getElementById('cancel-check');
  const btnJump = document.getElementById('test-jump');
  const btnSaveDB = document.getElementById('test-save-db');
  const btnLoadDB = document.getElementById('test-load-db');
  const btnSaveSettings = document.getElementById('save-settings');
  const output = document.getElementById('output');
  const problemListEl = document.getElementById('problem-list');
  const searchInput = document.getElementById('search-input');
  const typeFilter = document.getElementById('type-filter');

  // 设置相关元素
  const settingCheckMain = document.getElementById('setting-check-main');
  const settingFileWhitelist = document.getElementById('setting-file-whitelist');
  const settingFuncWhitelist = document.getElementById('setting-func-whitelist');
  const settingReturnTypeWhitelist = document.getElementById('setting-returntype-whitelist');

  /** @type {Array<any>} */
  let currentProblems = [];
  /** @type {Set<number|string>} */
  let completedIds = new Set();
  let currentSource = 'none';
  let currentSummary = '';
  let isChecking = false;

  // Webview 加载完成后主动向扩展请求当前配置，用于初始化设置页
  vscode.postMessage({ type: 'requestSettings' });

  // 1. 检查单个文件按钮
  if (btn) {
    btn.addEventListener('click', function () {
      if (output) {
        output.textContent = '正在选择文件...';
      }
      setEmptyState('正在选择文件...（单文件解析结果将显示在日志区）');
      vscode.postMessage({ type: 'runSingleFileCheck' });
    });
  }

  // 2. 检查整个项目按钮
  if (btnProjectCheck) {
    btnProjectCheck.addEventListener('click', function () {
      if (output) {
        output.textContent = '正在扫描项目...';
      }
      setEmptyState('正在扫描项目...（问题列表加载中）');
      setCheckingState(true);
      vscode.postMessage({ type: 'runProjectCheck' });
    });
  }

  // 2.1 取消检查按钮
  if (btnCancelCheck) {
    btnCancelCheck.addEventListener('click', function () {
      vscode.postMessage({ type: 'cancelCheck' });
    });
  }

  // 3. 测试跳转按钮
  if (btnJump) {
    btnJump.addEventListener('click', function () {
      if (output) {
        output.textContent = '正在测试跳转功能...';
      }
      vscode.postMessage({ type: 'testJumpToLocation' });
    });
  }

  // 4. 测试存储到数据库按钮
  if (btnSaveDB) {
    btnSaveDB.addEventListener('click', function () {
      if (output) {
        output.textContent = '正在测试存储到数据库...';
      }
      vscode.postMessage({ type: 'testSaveToDatabase' });
    });
  }

  // 5. 测试从数据库读取按钮
  if (btnLoadDB) {
    btnLoadDB.addEventListener('click', function () {
      if (output) {
        output.textContent = '正在测试从数据库读取...';
      }
      setEmptyState('正在从数据库读取...（问题列表加载中）');
      vscode.postMessage({ type: 'testLoadFromDatabase' });
    });
  }

  // 6. 保存设置按钮
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', function () {
      const settings = {
        checkMain: settingCheckMain ? settingCheckMain.checked : false,
        fileWhitelist: settingFileWhitelist ? settingFileWhitelist.value : '',
        funcWhitelist: settingFuncWhitelist ? settingFuncWhitelist.value : '',
        returnTypeWhitelist: settingReturnTypeWhitelist ? settingReturnTypeWhitelist.value : ''
      };
      vscode.postMessage({ type: 'saveSettings', data: settings });
      appendLog('正在保存设置...');
    });
  }

  // 筛选/搜索联动（存在则启用，不存在则保持旧逻辑）
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      renderProblems();
    });
  }
  if (typeFilter) {
    typeFilter.addEventListener('change', function () {
      renderProblems();
    });
  }

  // 接收扩展回传的各种结果并展示在页面上
  window.addEventListener('message', function (event) {
    const message = event.data;
    if (!message || !message.type) {
      return;
    }

    switch (message.type) {
      case 'initSettings':
        applyInitialSettings(message.data || {});
        break;
      case 'singleFileCheckResult':
        handleSingleFileCheckResult(message);
        break;
      case 'projectCheckResult':
        handleProjectCheckResult(message);
        break;
      case 'jumpToLocationResult':
        handleJumpToLocationResult(message);
        break;
      case 'databaseSaveResult':
        handleDatabaseSaveResult(message);
        break;
      case 'databaseLoadResult':
        handleDatabaseLoadResult(message);
        break;
      case 'log':
        appendLog(message.message || '');
        break;
      case 'settingsSaved':
        appendLog(message.success ? '✅ 设置已保存' : '❌ 设置保存失败');
        break;
      case 'problemStatusUpdated':
        if (message.data && message.data.success) {
          const id = message.data.id;
          const status = message.data.status;
          if (status === 1) {
            completedIds.add(id);
          } else {
            completedIds.delete(id);
          }
          renderProblems();
        }
        break;
      case 'checkCancelled':
        setCheckingState(false);
        appendLog('检查已取消');
        break;
    }
  });

  function applyInitialSettings(data) {
    try {
      if (settingCheckMain && typeof data.checkMain === 'boolean') {
        settingCheckMain.checked = data.checkMain;
      }
      if (settingFileWhitelist && typeof data.fileWhitelistText === 'string') {
        settingFileWhitelist.value = data.fileWhitelistText;
      }
      if (settingFuncWhitelist && typeof data.funcWhitelistText === 'string') {
        settingFuncWhitelist.value = data.funcWhitelistText;
      }
      if (
        settingReturnTypeWhitelist &&
        typeof data.returnTypeWhitelistText === 'string'
      ) {
        settingReturnTypeWhitelist.value = data.returnTypeWhitelistText;
      }
    } catch (e) {
      appendLog('初始化设置时出错: ' + e);
    }
  }

  function handleSingleFileCheckResult(message) {
    const filePath = message.filePath || '(未知文件)';
    const result = message.result;

    if (!result || !result.success) {
      const code = result && result.errorCode ? result.errorCode : 'UNKNOWN_ERROR';
      const err = result && result.error ? ' ' + result.error : '';
      if (output) {
        output.textContent = '检查失败: ' + filePath + ' - ' + code + err;
      }
      return;
    }

    const functions = Array.isArray(result.functions) ? result.functions : [];
    if (functions.length === 0) {
      if (output) {
        output.textContent = '检查完成: ' + filePath + '，未找到任何函数。';
      }
      return;
    }

    const lines = functions.map(function (f) {
      const name = f.functionName || '(匿名函数)';
      const line = typeof f.lineNumber === 'number' ? f.lineNumber : '?';
      const col = typeof f.columnNumber === 'number' ? f.columnNumber : '?';
      const comment = f.comment ? '\n  注释: ' + f.comment.substring(0, 100) : '';
      return '- ' + name + ' (行 ' + line + ', 列 ' + col + ')' + comment;
    });

    if (output) {
      output.textContent = '检查完成: ' + filePath + '\n共解析到 ' + functions.length + ' 个函数:\n\n' + lines.join('\n');
    }
  }

  function handleProjectCheckResult(message) {
    setCheckingState(false);
    const result = message.result;

    if (!result) {
      if (output) {
        output.textContent = '项目检查失败：未收到结果';
      }
      setEmptyState('项目检查失败：未收到结果');
      return;
    }

    currentSource = 'project';
    currentProblems = Array.isArray(result.problems) ? result.problems : [];
    completedIds.clear(); // 新检查清空已完成状态
    currentSummary =
      '=== 项目检查结果 ===\n\n' +
      '总文件数: ' + result.totalFiles + '\n' +
      '已检查: ' + result.checkedFiles + '\n' +
      '跳过: ' + (result.skippedFiles ? result.skippedFiles.length : 0) + '\n' +
      '发现问题数: ' + currentProblems.length + '\n';

    if (result.skippedFiles && result.skippedFiles.length > 0) {
      currentSummary += '\n跳过的文件(前5个):\n';
      result.skippedFiles.slice(0, 5).forEach(function (file) {
        currentSummary += '  - ' + file + '\n';
      });
      if (result.skippedFiles.length > 5) {
        currentSummary += '  ... 还有 ' + (result.skippedFiles.length - 5) + ' 个\n';
      }
    }

    if (output) {
      output.textContent = currentSummary;
    }
    renderProblems();
  }

  function handleJumpToLocationResult(message) {
    if (!output) {
      return;
    }

    if (message.success) {
      output.textContent = '跳转成功！\n文件: ' + message.filePath + '\n行: ' + message.lineNumber + '\n列: ' + message.columnNumber;
    } else {
      output.textContent = '跳转失败';
    }
  }

  function handleDatabaseSaveResult(message) {
    const result = message.result;
    
    if (!output) {
      return;
    }

    if (result && result.success) {
      output.textContent = '✅ ' + result.message + (result.insertedId ? '\n插入的ID: ' + result.insertedId : '');
    } else {
      output.textContent = '❌ ' + (result ? result.message : '存储失败');
    }
  }

  function handleDatabaseLoadResult(message) {
    const result = message.result;
    
    if (!output) {
      return;
    }

    if (!result || !result.success) {
      output.textContent = '❌ ' + (result ? result.message : '读取失败');
      setEmptyState('❌ ' + (result ? result.message : '读取失败'));
      return;
    }

    currentSource = 'database';
    currentProblems = Array.isArray(result.problems) ? result.problems : [];
    currentSummary =
      '✅ ' + result.message + '\n\n' +
      '=== 数据库中的问题 ===\n' +
      '记录数: ' + currentProblems.length + '\n';
    output.textContent = currentSummary;
    renderProblems();
  }

  function appendLog(text) {
    if (!output) {
      return;
    }
    if (!text) {
      return;
    }
    output.textContent = (output.textContent || '') + '\n' + String(text);
  }

  function setEmptyState(text) {
    if (!problemListEl) {
      return;
    }
    problemListEl.innerHTML = '<div class="empty-state"></div>';
    const el = problemListEl.querySelector('.empty-state');
    if (el) {
      el.textContent = text || '暂无数据';
    }
  }

  function setCheckingState(checking) {
    isChecking = checking;
    if (btnProjectCheck) {
      btnProjectCheck.disabled = checking;
    }
    if (btnCancelCheck) {
      btnCancelCheck.style.display = checking ? 'block' : 'none';
    }
  }

  function renderProblems() {
    if (!problemListEl) {
      return;
    }

    const q = (searchInput && typeof searchInput.value === 'string')
      ? searchInput.value.trim().toLowerCase()
      : '';
    const typeVal = typeFilter && typeFilter.value ? String(typeFilter.value) : 'all';

    const filtered = currentProblems.filter(function (p) {
      if (!p) {
        return false;
      }
      const pt = p.problemType != null ? String(p.problemType) : '';
      if (typeVal !== 'all' && pt !== typeVal) {
        return false;
      }
      if (!q) {
        return true;
      }
      const hay =
        (p.functionName || '') + ' ' +
        (p.filePath || '') + ' ' +
        (p.functionSignature || '') + ' ' +
        (p.problemDescription || '');
      return hay.toLowerCase().indexOf(q) !== -1;
    });

    if (filtered.length === 0) {
      const hint = currentSource === 'none'
        ? '点击“检查整个项目”开始扫描，发现的问题会显示在这里'
        : '没有匹配的结果';
      setEmptyState(hint);
      return;
    }

    // 排序：已完成的放后面
    const sorted = filtered.slice().sort(function (a, b) {
      const aCompleted = completedIds.has(getProblemId(a)) ? 1 : 0;
      const bCompleted = completedIds.has(getProblemId(b)) ? 1 : 0;
      return aCompleted - bCompleted;
    });

    problemListEl.innerHTML = '';
    sorted.slice(0, 200).forEach(function (p) {
      const pid = getProblemId(p);
      const isCompleted = completedIds.has(pid);

      const card = document.createElement('div');
      card.className = 'problem-card' + (isCompleted ? ' completed' : '');

      // 标记完成按钮
      const markBtn = document.createElement('button');
      markBtn.className = 'mark-btn';
      markBtn.textContent = isCompleted ? '✓' : '○';
      markBtn.title = isCompleted ? '取消完成' : '标记为已完成';
      markBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const newStatus = isCompleted ? 0 : 1;
        vscode.postMessage({ type: 'updateProblemStatus', data: { id: pid, status: newStatus } });
      });
      card.appendChild(markBtn);

      const header = document.createElement('div');
      header.className = 'card-header';

      const title = document.createElement('div');
      title.textContent = (p.functionName || '(未知函数)') + '  @ 行 ' + (p.lineNumber || '?');

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = isCompleted ? '已完成' : typeLabel(p.problemType);

      header.appendChild(title);
      header.appendChild(badge);

      const file = document.createElement('div');
      file.className = 'filename';
      file.textContent = (p.filePath || '(未知文件)') + (p.columnNumber ? ' : ' + p.columnNumber : '');

      const desc = document.createElement('div');
      desc.className = 'desc';
      desc.textContent = p.problemDescription || '(无描述)';

      card.appendChild(header);
      card.appendChild(file);
      card.appendChild(desc);

      // 点击跳转
      card.addEventListener('click', function () {
        const filePath = p.filePath;
        const line = p.lineNumber;
        const col = p.columnNumber || 1;
        if (typeof filePath === 'string' && typeof line === 'number') {
          vscode.postMessage({
            type: 'jumpToProblem',
            data: {
              filePath: filePath,
              line: line,
              col: col,
              functionName: p.functionName || undefined
            }
          });
        } else {
          appendLog('跳转失败：问题缺少 filePath/lineNumber');
        }
      });

      problemListEl.appendChild(card);
    });

    if (filtered.length > 200) {
      const more = document.createElement('div');
      more.className = 'empty-state';
      more.textContent = '已截断展示前 200 条（总计 ' + filtered.length + ' 条）';
      problemListEl.appendChild(more);
    }
  }

  function typeLabel(problemType) {
    switch (Number(problemType)) {
      case 1: return '参数缺失';
      case 2: return '返回值缺失';
      case 3: return '说明缺失';
      case 4: return '变更警告';
      case 5: return '语法错误';
      default: return '未知类型';
    }
  }

  function getProblemId(p) {
    // 优先使用数据库 id，否则用组合键
    if (p.id != null) {
      return p.id;
    }
    return (p.filePath || '') + ':' + (p.lineNumber || 0) + ':' + (p.functionName || '');
  }
})();
