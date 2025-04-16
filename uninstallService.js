const { Service } = require('node-windows');

const svc = new Service({
  name: 'Printing order service', 
  script: require('path').join(__dirname, '/bin/www') 
});

svc.on('uninstall', () => {
  console.log('Service uninstalled');
  console.log('Service exists:', svc.exists);
});

svc.uninstall();
