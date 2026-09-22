#!/bin/zsh -l
cd -- "$(dirname -- "$0")" || exit 1
npm run admin
printf '\n后台已关闭。按回车退出。\n'
read
