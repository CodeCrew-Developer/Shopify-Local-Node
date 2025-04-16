const { Service } = require("node-windows");

const svc = new Service({
  name: "Printing order service",
  description: "A service to print orders",
  script: require("path").join(__dirname, "/bin/www"),
  env: [
    {
      name: "DATABASE_URL",
      value: "file:./dev.db",
    },
    {
      name: "PORT",
      value: "8000",
    },
  ],
  logpath: require("path").join(__dirname, "logs"),
});

svc.on("install", () => {
  console.log("Service installed");
  svc.start();
});

svc.install();
