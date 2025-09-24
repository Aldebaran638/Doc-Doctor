@echo off
echo Starting TypeScript compilation...
call npx tsc main.ts
echo Compilation finished. Checking if main.js exists...

if exist main.js (
    echo main.js exists. Running the file...
    node main.js
) else (
    echo main.js does not exist! Compilation might have failed.
)

echo Process finished.
pause