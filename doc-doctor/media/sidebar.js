(function () {
  const vscode = acquireVsCodeApi();
  const btn = document.getElementById('run-check');
  const btnProjectCheck = document.getElementById('run-project-check');
  const btnJump = document.getElementById('test-jump');
  const btnSaveDB = document.getElementById('test-save-db');
  const btnLoadDB = document.getElementById('test-load-db');
  const output = document.getElementById('output');

  // 1. 检查单个文件按钮
  if (btn) {
    btn.addEventListener('click', function () {
      if (output) {
        output.textContent = '正在选择文件...';
      }
      vscode.postMessage({ type: 'runSingleFileCheck' });
    });
  }

  // 2. 检查整个项目按钮
  if (btnProjectCheck) {
    btnProjectCheck.addEventListener('click', function () {
      if (output) {
        output.textContent = '正在扫描项目...';
      }
      vscode.postMessage({ type: 'runProjectCheck' });
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
      vscode.postMessage({ type: 'testLoadFromDatabase' });
    });
  }

  // 接收扩展回传的各种结果并展示在页面上
  window.addEventListener('message', function (event) {
    const message = event.data;
    if (!message || !message.type) {
      return;
    }

    switch (message.type) {
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
    }
  });

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
    const result = message.result;

    if (!result) {
      if (output) {
        output.textContent = '项目检查失败：未收到结果';
      }
      return;
    }

    let text = '=== 项目检查结果 ===\n\n';
    text += '总文件数: ' + result.totalFiles + '\n';
    text += '已检查: ' + result.checkedFiles + '\n';
    text += '跳过: ' + result.skippedFiles.length + '\n';
    text += '发现问题数: ' + result.problems.length + '\n\n';

    if (result.skippedFiles.length > 0) {
      text += '跳过的文件:\n';
      result.skippedFiles.slice(0, 5).forEach(function(file) {
        text += '  - ' + file + '\n';
      });
      if (result.skippedFiles.length > 5) {
        text += '  ... 还有 ' + (result.skippedFiles.length - 5) + ' 个\n';
      }
      text += '\n';
    }

    if (result.problems.length > 0) {
      text += '问题列表 (前10个):\n';
      result.problems.slice(0, 10).forEach(function(problem, index) {
        text += (index + 1) + '. ' + problem.functionName + ' - ' + problem.problemDescription + '\n';
        text += '   文件: ' + problem.filePath + ' (行 ' + problem.lineNumber + ')\n';
      });
      if (result.problems.length > 10) {
        text += '... 还有 ' + (result.problems.length - 10) + ' 个问题\n';
      }
    } else {
      text += '✅ 未发现问题！';
    }

    if (output) {
      output.textContent = text;
    }
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
      return;
    }

    let text = '✅ ' + result.message + '\n\n';
    text += '=== 数据库中的问题 ===\n\n';

    if (result.problems && result.problems.length > 0) {
      result.problems.forEach(function(problem, index) {
        text += (index + 1) + '. [ID: ' + problem.id + '] ' + problem.functionName + '\n';
        text += '   问题: ' + problem.problemDescription + '\n';
        text += '   文件: ' + problem.filePath + ' (行 ' + problem.lineNumber + ')\n';
        text += '   状态: ' + (problem.status === 0 ? '正常' : '已完成') + '\n\n';
      });
    } else {
      text += '数据库为空';
    }

    output.textContent = text;
  }
})();
