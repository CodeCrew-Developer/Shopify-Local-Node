/*
  Warnings:

  - You are about to drop the column `pdfPath` on the `LineItem` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `LineItem` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "OrderPdf" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "pdfPath" TEXT NOT NULL,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderPdf_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LineItem" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "orderId" INTEGER NOT NULL,
    "orderPdfId" INTEGER,
    "title" TEXT NOT NULL,
    "productId" BIGINT NOT NULL,
    "variantId" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    CONSTRAINT "LineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LineItem_orderPdfId_fkey" FOREIGN KEY ("orderPdfId") REFERENCES "OrderPdf" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LineItem" ("category", "id", "orderId", "price", "productId", "properties", "quantity", "sku", "title", "variantId") SELECT "category", "id", "orderId", "price", "productId", "properties", "quantity", "sku", "title", "variantId" FROM "LineItem";
DROP TABLE "LineItem";
ALTER TABLE "new_LineItem" RENAME TO "LineItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
