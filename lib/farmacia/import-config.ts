/**
 * Configurable column map for the Farmacia importer.
 *
 * Built against ShippyPro exports now; when the source becomes Market Rock
 * (one file, all channels) only this map changes — the transform/persist code
 * stays the same. Each logical field names the source header(s) to read; the
 * first present header wins, so several candidate names can be listed.
 *
 * NOTE: the ShippyPro header strings below are best-guess until the real export
 * is seen. Adjust the candidate arrays to match the actual file.
 */

export interface ColumnMap {
  orderExtId: string[]
  orderDate: string[]
  phone: string[]
  email: string[]
  firstName: string[]
  lastName: string[]
  fullName: string[]
  channel: string[]      // source column → origin (amazon/ebay/online_store)
  orderTotal: string[]
  sku: string[]
  ean: string[]
  description: string[]
  qty: string[]
  unitPrice: string[]
  lineTotal: string[]
  category: string[]     // Market Rock category if present
  shipName: string[]
  shipAddress: string[]
  shipCity: string[]
  shipZip: string[]
  shipProvince: string[]
  shipCountry: string[]
}

export const SHIPPYPRO_MAP: ColumnMap = {
  orderExtId: ['Order ID', 'Order Id', 'Numero Ordine', 'Order Number'],
  orderDate: ['Order Date', 'Data Ordine', 'Date'],
  phone: ['Phone', 'Telefono', 'Phone Number'],
  email: ['Email', 'E-mail'],
  firstName: ['First Name', 'Nome'],
  lastName: ['Last Name', 'Cognome'],
  fullName: ['Customer', 'Cliente', 'Name', 'Nome Completo'],
  channel: ['Marketplace', 'Source', 'Canale', 'Channel', 'Carrier'],
  orderTotal: ['Total', 'Totale', 'Order Total', 'Total Order Amount'],
  sku: ['SKU', 'Sku', 'Codice'],
  ean: ['EAN', 'Ean', 'Barcode'],
  description: ['Product', 'Description', 'Descrizione', 'Item Name'],
  qty: ['Quantity', 'Qty', 'Quantità', 'Quantita'],
  unitPrice: ['Unit Price', 'Prezzo Unitario', 'Price'],
  lineTotal: ['Line Total', 'Totale Riga', 'Item Total'],
  category: ['Category', 'Categoria'],
  shipName: ['Ship To', 'Destinatario', 'Shipping Name'],
  shipAddress: ['Shipping Address', 'Indirizzo Spedizione', 'Address'],
  shipCity: ['Shipping City', 'Città', 'City'],
  shipZip: ['Shipping Zip', 'CAP', 'Zip', 'Postal Code'],
  shipProvince: ['Shipping Province', 'Provincia', 'Province', 'State'],
  shipCountry: ['Shipping Country', 'Paese', 'Country'],
}

/** Market Rock map — to fill in when that export format is known. */
export const MARKET_ROCK_MAP: ColumnMap = { ...SHIPPYPRO_MAP }

/** Pick the value of the first present (non-empty) candidate header in a row. */
export function pick(row: Record<string, string>, candidates: string[]): string | null {
  for (const key of candidates) {
    const v = row[key]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return null
}
