#!/bin/bash

# 检查端口是否被占用
if lsof -Pi :6173 -sTCP:LISTEN -t >/dev/null ; then
    echo "端口 6173 已被占用，正在关闭..."
    lsof -ti:6173 | xargs kill -9
    sleep 1
fi

# 启动开发服务器
npm run electron:dev

