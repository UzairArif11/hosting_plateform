module.exports = {
  apps: [
    {
      name: 'backend',
      script: './backend/server.js',
      cwd: '.',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M'
    },
    {
      name: 'frontend',
      script: './frontend/node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '.',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_API_URL: 'http://129.154.255.90:5000'
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '300M'
    }
  ]
};

