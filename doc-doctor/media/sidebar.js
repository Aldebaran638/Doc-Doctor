(function () {
  const vscode = acquireVsCodeApi();
  const btn = document.getElementById('run-check');
  const output = document.getElementById('output');

  if (btn) {
    btn.addEventListener('click', function () {
      if (output) {
        output.textContent = '按钮已点击，正在请求检查...';
      }
      vscode.postMessage({ type: 'runSingleFileCheck' });
    });
  }

  window.addEventListener('message', function (event) {
    const message = event.data;
    if (!message || message.type !== 'singleFileCheckResult') {
      return;
    }

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
      return '- ' + name + ' (行 ' + line + ', 列 ' + col + ')';
    });

    if (output) {
      output.textContent = '检查完成: ' + filePath + '\n共解析到 ' + functions.length + ' 个函数:\n' + lines.join('\n');
    }
  });
})();
