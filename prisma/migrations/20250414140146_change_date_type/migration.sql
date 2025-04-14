-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "node" TEXT,
    "customAttributes" JSONB NOT NULL,
    "deliveryAddress" TEXT,
    "deliveryDate" TEXT,
    "deliveryTime" TEXT,
    "storeLocation" TEXT,
    "deliveryMethod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("createdAt", "customAttributes", "customerId", "deliveryAddress", "deliveryDate", "deliveryMethod", "deliveryTime", "id", "node", "storeLocation") SELECT "createdAt", "customAttributes", "customerId", "deliveryAddress", "deliveryDate", "deliveryMethod", "deliveryTime", "id", "node", "storeLocation" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
