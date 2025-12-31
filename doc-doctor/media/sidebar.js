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
  const panelsEl = document.querySelector('vscode-panels');
  const panelTabs = Array.from(document.querySelectorAll('vscode-panel-tab'));
  const panelViews = Array.from(document.querySelectorAll('vscode-panel-view'));

  // 设置相关元素
  const settingCheckMain = document.getElementById('setting-check-main');
  const settingFileWhitelist = document.getElementById('setting-file-whitelist');
  const settingFuncWhitelist = document.getElementById('setting-func-whitelist');
  const settingReturnTypeWhitelist = document.getElementById('setting-returntype-whitelist');
  const settingAIEnable = document.getElementById('setting-ai-enable');
  const settingAIEndpoint = document.getElementById('setting-ai-endpoint');
  const settingAIApiKey = document.getElementById('setting-ai-apikey');
  const settingAIModel = document.getElementById('setting-ai-model');
  const settingAITemperature = document.getElementById('setting-ai-temperature');
  const settingAITimeout = document.getElementById('setting-ai-timeout');

  /** @type {Array<any>} */
  let currentProblems = [];
  /** @type {Set<number|string>} */
  let completedIds = new Set();
  let currentSource = 'none';
  let currentSummary = '';
  let isChecking = false;
  let tabDebugCount = 0;
  const TAB_DEBUG_LIMIT = 120;

  function logTabDebug(message) {
    if (tabDebugCount >= TAB_DEBUG_LIMIT) {
      return;
    }
    tabDebugCount += 1;
    const line = '[TabDebug] ' + message;
    appendLog(line);
    // 在 Webview 控制台也输出，便于定位点击/布局问题
    console.log(line);
    vscode.postMessage({ type: 'tabDebug', message: line });
    if (tabDebugCount === TAB_DEBUG_LIMIT) {
      appendLog('[TabDebug] 日志数量已达上限，后续将停止输出。');
      vscode.postMessage({
        type: 'tabDebug',
        message: '[TabDebug] log limit reached'
      });
    }
  }

  function logPanelsState(reason) {
    if (!panelsEl) {
      logTabDebug(reason + ' - 未找到 vscode-panels');
      return;
    }
    const activeId = panelsEl.getAttribute('activeid');
    const orientation = panelsEl.getAttribute('orientation');
    const rect = panelsEl.getBoundingClientRect();
    logTabDebug(
      reason +
        ' activeid=' +
        (activeId || 'null') +
        ' orientation=' +
        (orientation || 'default') +
        ' panels=' +
        Math.round(rect.width) +
        'x' +
        Math.round(rect.height)
    );
    if (reason.indexOf('tab-click') !== -1 || reason.indexOf('activeid-changed') !== -1) {
      panelViews.forEach(function (view) {
        const viewRect = view.getBoundingClientRect();
        const viewStyle = window.getComputedStyle(view);
        logTabDebug(
          'view ' +
            (view.id || '(no-id)') +
            ' hidden=' +
            (view.hasAttribute('hidden') ? 'yes' : 'no') +
            ' display=' +
            viewStyle.display +
            ' w=' +
            Math.round(viewRect.width) +
            ' h=' +
            Math.round(viewRect.height)
        );
      });
      panelTabs.forEach(function (tab) {
        const tabRect = tab.getBoundingClientRect();
        const style = window.getComputedStyle(tab);
        logTabDebug(
          'tab ' +
            (tab.id || '(no-id)') +
            ' text="' +
            (tab.textContent || '').trim() +
            '" w=' +
            Math.round(tabRect.width) +
            ' h=' +
            Math.round(tabRect.height) +
            ' cw=' +
            tab.clientWidth +
            ' sw=' +
            tab.scrollWidth +
            ' display=' +
            style.display +
            ' whiteSpace=' +
            style.whiteSpace +
            ' writingMode=' +
            style.writingMode +
            ' flex=' +
            style.flex
        );
      });
    }
  }

  // 调整标签栏位置，使其与内容区域左侧对齐
  function alignTabsWithContent() {
    if (!panelsEl) {
      return;
    }
    
    // 尝试多种方式查找标签栏容器
    const shadowRoot = panelsEl.shadowRoot;
    const tabContainer = (shadowRoot && shadowRoot.querySelector('[role="tablist"]')) ||
                         (shadowRoot && shadowRoot.querySelector('.tabs')) ||
                         (shadowRoot && shadowRoot.querySelector('div:first-child')) ||
                         panelsEl.querySelector('[role="tablist"]') ||
                         panelsEl.querySelector('.tabs');
    
    if (tabContainer) {
      tabContainer.style.paddingLeft = '16px';
      tabContainer.style.boxSizing = 'border-box';
      logTabDebug('标签栏对齐：已找到容器并设置 padding-left');
    } else {
      // 如果找不到容器，直接调整第一个标签的 margin
      if (panelTabs.length > 0) {
        panelTabs[0].style.marginLeft = '16px';
        logTabDebug('标签栏对齐：使用第一个标签的 margin-left');
      } else {
        logTabDebug('标签栏对齐：未找到标签栏容器或标签');
      }
    }
  }

  // 移除标签下划线，使用其他方式突出活动标签
  function removeTabUnderlines() {
    if (!panelsEl) {
      return;
    }
    
    // 在 Shadow DOM 中添加样式来移除下划线
    if (panelsEl.shadowRoot) {
      let styleSheet = panelsEl.shadowRoot.querySelector('style[data-remove-underline]');
      if (!styleSheet) {
        styleSheet = document.createElement('style');
        styleSheet.setAttribute('data-remove-underline', 'true');
        styleSheet.textContent = `
          vscode-panel-tab,
          vscode-panel-tab *,
          [role="tab"],
          [role="tab"] * {
            border-bottom: none !important;
            text-decoration: none !important;
            box-shadow: none !important;
          }
          vscode-panel-tab::before,
          vscode-panel-tab::after,
          [role="tab"]::before,
          [role="tab"]::after {
            display: none !important;
            border-bottom: none !important;
            content: none !important;
          }
          /* 移除所有可能的底部边框 */
          [role="tablist"] > * {
            border-bottom: none !important;
          }
        `;
        panelsEl.shadowRoot.appendChild(styleSheet);
        logTabDebug('标签下划线：已在 Shadow DOM 中添加样式移除下划线');
      }
    }
    
    // 直接操作标签元素，移除下划线
    panelTabs.forEach(function(tab) {
      tab.style.borderBottom = 'none';
      tab.style.setProperty('border-bottom', 'none', 'important');
      tab.style.textDecoration = 'none';
      
      // 如果标签有 Shadow DOM，也在其中移除
      if (tab.shadowRoot) {
        const tabElements = tab.shadowRoot.querySelectorAll('*');
        tabElements.forEach(function(el) {
          el.style.borderBottom = 'none';
          el.style.textDecoration = 'none';
        });
      }
    });
  }

  // Webview 加载完成后主动向扩展请求当前配置，用于初始化设置页
  vscode.postMessage({ type: 'requestSettings' });

  // Tab 相关调试日志，定位布局/点击问题
  logTabDebug(
    'customElements vscode-panels defined=' +
      (customElements.get('vscode-panels') ? 'yes' : 'no')
  );
  if (panelTabs.length !== panelViews.length) {
    logTabDebug(
      'tabs/views 数量不匹配 tabs=' +
        panelTabs.length +
        ' views=' +
        panelViews.length
    );
  }
  logPanelsState('init');
  if (panelsEl) {
    const observer = new MutationObserver(function (mutations) {
      const changed = mutations.some(function (m) {
        return m.type === 'attributes' && m.attributeName === 'activeid';
      });
      if (changed) {
        logPanelsState('activeid-changed');
        // 标签切换时移除下划线
        setTimeout(function() {
          removeTabUnderlines();
        }, 50);
      }
    });
    observer.observe(panelsEl, {
      attributes: true,
      attributeFilter: ['activeid']
    });
    
    // 延迟调整标签栏位置和移除下划线，确保 Web Components 已完全初始化
    setTimeout(function() {
      alignTabsWithContent();
      removeTabUnderlines();
    }, 100);
    
    // 监听 DOM 变化，如果标签栏结构发生变化，重新调整
    const tabsObserver = new MutationObserver(function() {
      alignTabsWithContent();
      removeTabUnderlines();
    });
    if (panelsEl.shadowRoot) {
      tabsObserver.observe(panelsEl.shadowRoot, { childList: true, subtree: true });
    }
    tabsObserver.observe(panelsEl, { childList: true, subtree: true });
    
    panelsEl.addEventListener('click', function (e) {
      const target = e.target instanceof Element ? e.target : null;
      const tab = target ? target.closest('vscode-panel-tab') : null;
      logPanelsState('panels-click' + (tab ? ':' + tab.id : ''));
    });
  }
  panelTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      logPanelsState('tab-click:' + (tab.id || 'no-id'));
    });
  });

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
        output.textContent = '正在将当前问题列表存储到数据库...';
      }
      const problemsToSave = getFilteredProblems();
      vscode.postMessage({ type: 'testSaveToDatabase', data: { problems: problemsToSave } });
    });
  }

  // 5. 测试从数据库读取按钮
  if (btnLoadDB) {
    btnLoadDB.addEventListener('click', function () {
      if (output) {
        output.textContent = '正在从数据库读取问题详情...';
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
        returnTypeWhitelist: settingReturnTypeWhitelist ? settingReturnTypeWhitelist.value : '',
        aiEnabled: settingAIEnable ? settingAIEnable.checked : false,
        aiEndpoint: settingAIEndpoint ? settingAIEndpoint.value : '',
        aiApiKey: settingAIApiKey ? settingAIApiKey.value : '',
        aiModel: settingAIModel ? settingAIModel.value : 'gpt-4',
        aiTemperature: settingAITemperature ? parseFloat(settingAITemperature.value) || 0.7 : 0.7,
        aiTimeout: settingAITimeout ? parseInt(settingAITimeout.value) || 60000 : 60000
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
      case 'aiFixPreview':
        showAIFixPreview(message.data);
        break;
      case 'aiFixApplied':
        appendLog('✅ AI修复已应用到文件');
        // 可选：刷新问题列表
        break;
      case 'aiFixError':
        appendLog('❌ AI修复失败: ' + (message.message || '未知错误'));
        hideAIFixLoading();
        // 恢复按钮状态
        if (currentAIFixProblem) {
          const problemId = getProblemId(currentAIFixProblem);
          const button = document.getElementById(`ai-fix-btn-${problemId}`);
          if (button) {
            button.disabled = false;
            button.textContent = 'AI修复注释';
            button.classList.remove('loading');
          }
        }
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
      // AI 配置
      if (settingAIEnable && typeof data.aiEnabled === 'boolean') {
        settingAIEnable.checked = data.aiEnabled;
      }
      if (settingAIEndpoint && typeof data.aiEndpoint === 'string') {
        settingAIEndpoint.value = data.aiEndpoint;
      }
      if (settingAIApiKey && typeof data.aiApiKey === 'string') {
        settingAIApiKey.value = data.aiApiKey;
      }
      if (settingAIModel && typeof data.aiModel === 'string') {
        settingAIModel.value = data.aiModel;
      }
      if (settingAITemperature && typeof data.aiTemperature === 'number') {
        settingAITemperature.value = String(data.aiTemperature);
      }
      if (settingAITimeout && typeof data.aiTimeout === 'number') {
        settingAITimeout.value = String(data.aiTimeout);
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
    
    // 重建 completedIds 集合：从数据库加载的问题中，status=1 表示已完成
    completedIds.clear();
    currentProblems.forEach(function (p) {
      if (p.status === 1) {
        completedIds.add(getProblemId(p));
      }
    });
    
    currentSummary =
      '✅ ' + result.message + '\n\n' +
      '=== 数据库中的问题 ===\n' +
      '记录数: ' + currentProblems.length + '\n';

    // 在输出日志中打印每条问题的详细信息
    const lines = currentProblems.map(function (p, idx) {
      const id = p.id != null ? p.id : idx + 1;
      const type = typeLabel(p.problemType);
      const file = p.filePath || '(未知文件)';
      const line = p.lineNumber || 0;
      const col = p.columnNumber || 0;
      const func = p.functionName || '(未知函数)';
      const desc = p.problemDescription || '';
      return (
        '[' + id + '] ' + type + ' ' + file + ':' + line + ':' + col +
        ' ' + func + ' - ' + desc
      );
    });

    output.textContent =
      currentSummary + (lines.length > 0 ? '\n' + lines.join('\n') : '');
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

  function getFilteredProblems() {
    const q = (searchInput && typeof searchInput.value === 'string')
      ? searchInput.value.trim().toLowerCase()
      : '';
    const typeVal = typeFilter && typeFilter.value ? String(typeFilter.value) : 'all';

    return currentProblems.filter(function (p) {
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
  }

  function renderProblems() {
    if (!problemListEl) {
      return;
    }
    const filtered = getFilteredProblems();

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

      // AI修复按钮（仅对问题类型1/2/3/4显示）
      const problemTypeNum = Number(p.problemType);
      if (problemTypeNum >= 1 && problemTypeNum <= 4) {
        const aiFixBtn = document.createElement('button');
        aiFixBtn.className = 'ai-fix-btn';
        aiFixBtn.id = `ai-fix-btn-${getProblemId(p)}`;
        aiFixBtn.textContent = 'AI修复注释';
        aiFixBtn.title = '使用AI生成或更新注释';
        aiFixBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          handleAIFixClick(p, aiFixBtn);
        });
        card.appendChild(aiFixBtn);
      }

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

  // AI修复相关函数
  let aiFixLoading = false;
  let currentAIFixProblem = null;
  let currentAIFixNewComment = null; // 保存当前预览的新注释内容

  function handleAIFixClick(problem, buttonElement) {
    if (aiFixLoading) {
      appendLog('AI修复请求正在进行中，请稍候...');
      return;
    }

    currentAIFixProblem = problem;
    aiFixLoading = true;
    
    // 更新按钮状态为加载中
    if (buttonElement) {
      buttonElement.disabled = true;
      buttonElement.textContent = '生成中...';
      buttonElement.classList.add('loading');
    }
    
    appendLog('正在请求AI生成注释...');

    // 发送AI修复请求
    vscode.postMessage({
      type: 'aiFixComment',
      data: { problem: problem }
    });
  }

  function showAIFixPreview(data) {
    aiFixLoading = false;
    // 恢复按钮状态
    const problemId = getProblemId(data.problem);
    const button = document.getElementById(`ai-fix-btn-${problemId}`);
    if (button) {
      button.disabled = false;
      button.textContent = 'AI修复注释';
      button.classList.remove('loading');
    }
    
    const problem = data.problem;
    const newComment = data.newComment;
    const oldComment = data.oldComment || '';
    
    // 保存新注释内容供 applyAIFix 使用
    currentAIFixNewComment = newComment;

    // 创建预览模态框
    const modal = document.createElement('div');
    modal.className = 'ai-fix-modal';
    modal.innerHTML = `
      <div class="ai-fix-modal-content">
        <div class="ai-fix-modal-header">
          <h3>AI修复注释预览</h3>
          <button class="ai-fix-close-btn">×</button>
        </div>
        <div class="ai-fix-modal-body">
          <div class="ai-fix-section">
            <h4>函数信息</h4>
            <p><strong>函数名:</strong> ${problem.functionName || '(未知)'}</p>
            <p><strong>文件:</strong> ${problem.filePath || '(未知)'}</p>
            <p><strong>行号:</strong> ${problem.lineNumber || '?'}</p>
          </div>
          <div class="ai-fix-section">
            <h4>注释对比</h4>
            <div class="ai-fix-comment-compare">
              <div class="ai-fix-comment-old">
                <div class="ai-fix-comment-label">原始注释</div>
                <pre class="ai-fix-comment-preview">${oldComment ? escapeHtml(oldComment) : '<em style="opacity: 0.6;">（无注释）</em>'}</pre>
              </div>
              <div class="ai-fix-comment-arrow">→</div>
              <div class="ai-fix-comment-new">
                <div class="ai-fix-comment-label">新注释</div>
                <pre class="ai-fix-comment-preview">${escapeHtml(newComment)}</pre>
              </div>
            </div>
          </div>
        </div>
        <div class="ai-fix-modal-footer">
          <button class="ai-fix-cancel-btn">取消</button>
          <button class="ai-fix-apply-btn">应用修改</button>
        </div>
      </div>
    `;

    // 添加样式
    if (!document.getElementById('ai-fix-modal-style')) {
      const style = document.createElement('style');
      style.id = 'ai-fix-modal-style';
      style.textContent = `
        .ai-fix-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .ai-fix-modal-content {
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-widget-border);
          border-radius: 12px;
          width: 100%;
          max-width: 700px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .ai-fix-modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--vscode-widget-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ai-fix-modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        .ai-fix-close-btn {
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          color: var(--vscode-foreground);
          padding: 0;
          width: 32px;
          height: 32px;
          line-height: 1;
          border-radius: 4px;
          transition: background 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ai-fix-close-btn:hover {
          background: var(--vscode-list-hoverBackground);
        }
        .ai-fix-modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }
        .ai-fix-section {
          margin-bottom: 24px;
        }
        .ai-fix-section:last-child {
          margin-bottom: 0;
        }
        .ai-fix-section h4 {
          margin: 0 0 12px 0;
          font-size: 15px;
          font-weight: 600;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        .ai-fix-section p {
          margin: 8px 0;
          font-size: 13px;
          line-height: 1.6;
        }
        .ai-fix-comment-compare {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 16px;
          align-items: start;
          margin-top: 8px;
        }
        .ai-fix-comment-old, .ai-fix-comment-new {
          flex: 1;
        }
        .ai-fix-comment-label {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--vscode-descriptionForeground);
        }
        .ai-fix-comment-arrow {
          font-size: 20px;
          color: var(--vscode-foreground);
          align-self: center;
          padding-top: 24px;
        }
        .ai-fix-comment-preview {
          background: var(--vscode-textCodeBlock-background);
          padding: 16px;
          border-radius: 6px;
          overflow-x: auto;
          font-family: var(--vscode-editor-font-family);
          font-size: 13px;
          white-space: pre-wrap;
          word-wrap: break-word;
          line-height: 1.6;
          border: 1px solid var(--vscode-widget-border);
          margin: 0;
          min-height: 80px;
          max-height: 400px;
          overflow-y: auto;
        }
        .ai-fix-comment-old .ai-fix-comment-preview {
          border-color: var(--vscode-inputValidation-warningBorder, #ff9800);
        }
        .ai-fix-comment-new .ai-fix-comment-preview {
          border-color: var(--vscode-inputValidation-infoBorder, #2196f3);
        }
        @media (max-width: 700px) {
          .ai-fix-comment-compare {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .ai-fix-comment-arrow {
            transform: rotate(90deg);
            align-self: center;
            padding: 0;
          }
        }
        .ai-fix-btn.loading {
          opacity: 0.7;
          cursor: not-allowed;
          position: relative;
        }
        .ai-fix-btn.loading::after {
          content: '';
          position: absolute;
          width: 12px;
          height: 12px;
          margin: auto;
          border: 2px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
        }
        @keyframes spin {
          0% { transform: translateY(-50%) rotate(0deg); }
          100% { transform: translateY(-50%) rotate(360deg); }
        }
        .ai-fix-modal-footer {
          padding: 20px 24px;
          border-top: 1px solid var(--vscode-widget-border);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .ai-fix-cancel-btn, .ai-fix-apply-btn {
          padding: 10px 20px;
          border: 1px solid var(--vscode-widget-border);
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .ai-fix-cancel-btn {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        .ai-fix-cancel-btn:hover {
          background: var(--vscode-button-secondaryHoverBackground);
          transform: translateY(-1px);
        }
        .ai-fix-apply-btn {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        .ai-fix-apply-btn:hover {
          background: var(--vscode-button-hoverBackground);
          transform: translateY(-1px);
        }
        .ai-fix-btn {
          margin-top: 12px;
          padding: 8px 12px;
          font-size: 12px;
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          border: 1px solid var(--vscode-widget-border);
          border-radius: 6px;
          cursor: pointer;
          width: 100%;
          transition: all 0.2s ease;
          font-weight: 500;
        }
        .ai-fix-btn:hover {
          background: var(--vscode-button-secondaryHoverBackground);
          transform: translateY(-1px);
        }
        .ai-fix-btn:active {
          transform: translateY(0);
        }
        @media (max-width: 600px) {
          .ai-fix-modal {
            padding: 10px;
          }
          .ai-fix-modal-content {
            max-height: 90vh;
          }
          .ai-fix-modal-header {
            padding: 16px;
          }
          .ai-fix-modal-body {
            padding: 16px;
          }
          .ai-fix-modal-footer {
            padding: 16px;
            flex-direction: column-reverse;
          }
          .ai-fix-cancel-btn, .ai-fix-apply-btn {
            width: 100%;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // 添加事件监听器
    modal.addEventListener('click', function(e) {
      const target = e.target;
      if (target.classList.contains('ai-fix-close-btn')) {
        currentAIFixNewComment = null;
        modal.remove();
      } else if (target.classList.contains('ai-fix-cancel-btn')) {
        currentAIFixNewComment = null;
        modal.remove();
      } else if (target.classList.contains('ai-fix-apply-btn')) {
        applyAIFix();
      }
    });

    // 添加应用修改函数到全局
    window.applyAIFix = function() {
      if (!currentAIFixProblem || !currentAIFixNewComment) {
        appendLog('❌ 无法应用修复：缺少问题信息或注释内容');
        return;
      }
      const modal = document.querySelector('.ai-fix-modal');
      if (!modal) {
        appendLog('❌ 无法找到预览模态框');
        return;
      }
      
      vscode.postMessage({
        type: 'applyAIFix',
        data: {
          problem: currentAIFixProblem,
          newComment: currentAIFixNewComment
        }
      });

      modal.remove();
      const problemId = getProblemId(currentAIFixProblem);
      currentAIFixProblem = null;
      currentAIFixNewComment = null;
      appendLog('正在应用AI修复...');
    };

    document.body.appendChild(modal);
  }

  function hideAIFixLoading() {
    aiFixLoading = false;
    // 恢复所有按钮状态
    if (currentAIFixProblem) {
      const problemId = getProblemId(currentAIFixProblem);
      const button = document.getElementById(`ai-fix-btn-${problemId}`);
      if (button) {
        button.disabled = false;
        button.textContent = 'AI修复注释';
        button.classList.remove('loading');
      }
    }
    currentAIFixProblem = null;
    currentAIFixNewComment = null;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
