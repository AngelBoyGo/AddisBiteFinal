module.exports = {
  apps: [
    {
      name: 'ab-preview',
      script: 'python3',
      args: '-m http.server 3000 --bind 0.0.0.0 --directory /home/user/webapp/preview',
      env: { NODE_ENV: 'development', PORT: 3000 },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
