import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CHECKS = [
  {
    name: "negative_inventory_quantities",
    severity: "error",
    sql: `
      SELECT id, organization_id, inventory_number
      FROM inventory_positions
      WHERE quantity_received < 0
         OR quantity_available < 0
         OR quantity_reserved < 0
         OR quantity_inspection < 0
         OR quantity_defective < 0
         OR quantity_sold < 0
    `,
  },
  {
    name: "owned_without_owned_lot",
    severity: "error",
    sql: `
      SELECT ip.id, ip.organization_id, ip.inventory_number
      FROM inventory_positions ip
      LEFT JOIN owned_stock_lots osl ON osl.inventory_position_id = ip.id
      WHERE ip.inventory_type = 'OWNED' AND osl.id IS NULL
    `,
  },
  {
    name: "consignment_without_consignment_lot",
    severity: "error",
    sql: `
      SELECT ip.id, ip.organization_id, ip.inventory_number
      FROM inventory_positions ip
      LEFT JOIN consignment_lots cl ON cl.inventory_position_id = ip.id
      WHERE ip.inventory_type = 'CONSIGNMENT' AND cl.id IS NULL
    `,
  },
  {
    name: "owned_with_consignment_lot",
    severity: "error",
    sql: `
      SELECT ip.id, ip.organization_id, ip.inventory_number
      FROM inventory_positions ip
      JOIN consignment_lots cl ON cl.inventory_position_id = ip.id
      WHERE ip.inventory_type = 'OWNED'
    `,
  },
  {
    name: "consignment_with_owned_lot",
    severity: "error",
    sql: `
      SELECT ip.id, ip.organization_id, ip.inventory_number
      FROM inventory_positions ip
      JOIN owned_stock_lots osl ON osl.inventory_position_id = ip.id
      WHERE ip.inventory_type = 'CONSIGNMENT'
    `,
  },
  {
    name: "sale_allocations_exceed_line_quantity",
    severity: "error",
    sql: `
      SELECT sl.id, sl.organization_id, sl.quantity, COALESCE(SUM(sla.quantity), 0) AS allocated
      FROM sale_lines sl
      LEFT JOIN sale_line_allocations sla ON sla.sale_line_id = sl.id
      GROUP BY sl.id, sl.organization_id, sl.quantity
      HAVING COALESCE(SUM(sla.quantity), 0) > sl.quantity
    `,
  },
  {
    name: "return_allocations_exceed_sold_allocation",
    severity: "error",
    sql: `
      SELECT sla.id, sla.organization_id, sla.quantity, COALESCE(SUM(ra.quantity), 0) AS returned
      FROM sale_line_allocations sla
      LEFT JOIN return_allocations ra ON ra.sale_line_allocation_id = sla.id
      GROUP BY sla.id, sla.organization_id, sla.quantity
      HAVING COALESCE(SUM(ra.quantity), 0) > sla.quantity
    `,
  },
  {
    name: "return_movement_reused_across_allocations",
    severity: "error",
    sql: `
      SELECT organization_id, movement_id, COUNT(*) AS allocation_count
      FROM (
        SELECT organization_id, receipt_movement_id AS movement_id
        FROM return_allocations
        WHERE receipt_movement_id IS NOT NULL
        UNION ALL
        SELECT organization_id, restock_movement_id AS movement_id
        FROM return_allocations
        WHERE restock_movement_id IS NOT NULL
        UNION ALL
        SELECT organization_id, defective_movement_id AS movement_id
        FROM return_allocations
        WHERE defective_movement_id IS NOT NULL
      ) linked_movements
      GROUP BY organization_id, movement_id
      HAVING COUNT(*) > 1
    `,
  },
  {
    name: "return_movement_link_mismatch",
    severity: "error",
    sql: `
      SELECT ra.id, ra.organization_id, linked.kind, linked.movement_id
      FROM return_allocations ra
      CROSS JOIN LATERAL (
        VALUES
          ('receipt', ra.receipt_movement_id, 'RETURN_RECEIPT'),
          ('restock', ra.restock_movement_id, 'RETURN_RESTOCK'),
          ('defective', ra.defective_movement_id, 'RETURN_DEFECTIVE')
      ) AS linked(kind, movement_id, expected_type)
      LEFT JOIN inventory_movements im ON im.id = linked.movement_id
      WHERE linked.movement_id IS NOT NULL
        AND (
          im.id IS NULL
          OR im.organization_id <> ra.organization_id
          OR im.movement_type::text <> linked.expected_type
        )
    `,
  },
  {
    name: "supplier_return_dispatch_without_valid_movement",
    severity: "error",
    sql: `
      SELECT srl.id, srl.organization_id, sr.status, srl.outbound_movement_id
      FROM supplier_return_lines srl
      JOIN supplier_returns sr ON sr.id = srl.supplier_return_id
      LEFT JOIN inventory_movements im ON im.id = srl.outbound_movement_id
      WHERE sr.status IN (
        'DISPATCHED',
        'ARRIVED',
        'REFUND_PENDING',
        'PARTIALLY_REFUNDED',
        'REFUNDED',
        'CREDIT_PENDING',
        'REPLACEMENT_PENDING',
        'COMPLETED'
      )
        AND (
          srl.outbound_movement_id IS NULL
          OR im.id IS NULL
          OR im.organization_id <> srl.organization_id
          OR im.inventory_position_id <> srl.inventory_position_id
          OR im.movement_type <> 'SUPPLIER_RETURN_OUT'
          OR im.quantity <> srl.quantity
        )
    `,
  },
  {
    name: "sale_line_without_sale",
    severity: "error",
    sql: `
      SELECT sl.id, sl.organization_id, sl.sale_id
      FROM sale_lines sl
      LEFT JOIN sales s ON s.id = sl.sale_id
      WHERE s.id IS NULL
    `,
  },
  {
    name: "debt_purchase_cross_tenant",
    severity: "error",
    sql: `
      SELECT dpl.id, dpl.organization_id, dpl.debt_id, dpl.purchase_id
      FROM debt_purchase_links dpl
      JOIN debts d ON d.id = dpl.debt_id
      JOIN purchases p ON p.id = dpl.purchase_id
      WHERE d.organization_id <> dpl.organization_id
         OR p.organization_id <> dpl.organization_id
    `,
  },
  {
    name: "debt_sale_cross_tenant",
    severity: "error",
    sql: `
      SELECT dsl.id, dsl.organization_id, dsl.debt_id, dsl.sale_id
      FROM debt_sale_links dsl
      JOIN debts d ON d.id = dsl.debt_id
      JOIN sales s ON s.id = dsl.sale_id
      WHERE d.organization_id <> dsl.organization_id
         OR s.organization_id <> dsl.organization_id
    `,
  },
  {
    name: "inventory_link_cross_tenant",
    severity: "error",
    sql: `
      SELECT dil.id, dil.organization_id, dil.debt_id, dil.inventory_position_id
      FROM debt_inventory_links dil
      JOIN debts d ON d.id = dil.debt_id
      JOIN inventory_positions ip ON ip.id = dil.inventory_position_id
      WHERE d.organization_id <> dil.organization_id
         OR ip.organization_id <> dil.organization_id
    `,
  },
  {
    name: "duplicate_document_numbers",
    severity: "error",
    sql: `
      SELECT organization_id, number, COUNT(*) AS count
      FROM (
        SELECT organization_id, purchase_number AS number FROM purchases WHERE purchase_number IS NOT NULL
        UNION ALL
        SELECT organization_id, inventory_number AS number FROM inventory_positions WHERE inventory_number IS NOT NULL
        UNION ALL
        SELECT organization_id, order_number AS number FROM sales WHERE order_number IS NOT NULL
        UNION ALL
        SELECT organization_id, return_number AS number FROM returns WHERE return_number IS NOT NULL
        UNION ALL
        SELECT organization_id, debt_number AS number FROM debts WHERE debt_number IS NOT NULL
      ) docs
      GROUP BY organization_id, number
      HAVING COUNT(*) > 1
    `,
  },
  {
    name: "duplicate_recurring_expense_occurrences",
    severity: "error",
    sql: `
      SELECT organization_id, recurring_source_expense_id, incurred_at, COUNT(*) AS count
      FROM expenses
      WHERE recurring_source_expense_id IS NOT NULL
      GROUP BY organization_id, recurring_source_expense_id, incurred_at
      HAVING COUNT(*) > 1
    `,
  },
  {
    name: "movement_replay_mismatch",
    severity: "error",
    sql: `
      WITH movement_deltas AS (
        SELECT
          inventory_position_id,
          SUM(CASE WHEN movement_type IN ('PURCHASE_RECEIPT', 'CONSIGNMENT_RECEIPT', 'ADJUSTMENT_IN') THEN quantity
                   WHEN movement_type = 'RETURN_RECEIPT' THEN quantity
                   WHEN movement_type = 'REVERSAL' AND reference_id IN (
                     SELECT id FROM inventory_movements WHERE movement_type IN ('PURCHASE_RECEIPT', 'CONSIGNMENT_RECEIPT', 'ADJUSTMENT_IN', 'RETURN_RECEIPT')
                   ) THEN -quantity
                   ELSE 0 END) AS quantity_received,
          SUM(CASE WHEN to_bucket = 'AVAILABLE' THEN quantity ELSE 0 END) -
          SUM(CASE WHEN from_bucket = 'AVAILABLE' THEN quantity ELSE 0 END) AS quantity_available,
          SUM(CASE WHEN to_bucket = 'RESERVED' THEN quantity ELSE 0 END) -
          SUM(CASE WHEN from_bucket = 'RESERVED' THEN quantity ELSE 0 END) AS quantity_reserved,
          SUM(CASE WHEN to_bucket = 'INSPECTION' THEN quantity ELSE 0 END) -
          SUM(CASE WHEN from_bucket = 'INSPECTION' THEN quantity ELSE 0 END) AS quantity_inspection,
          SUM(CASE WHEN to_bucket = 'DEFECTIVE' THEN quantity ELSE 0 END) -
          SUM(CASE WHEN from_bucket = 'DEFECTIVE' THEN quantity ELSE 0 END) AS quantity_defective,
          SUM(CASE WHEN movement_type = 'SALE_OUT' THEN quantity
                   WHEN movement_type = 'RETURN_RECEIPT' THEN -quantity
                   WHEN movement_type = 'REVERSAL' AND reference_id IN (
                     SELECT id FROM inventory_movements WHERE movement_type = 'SALE_OUT'
                   ) THEN -quantity
                   WHEN movement_type = 'REVERSAL' AND reference_id IN (
                     SELECT id FROM inventory_movements WHERE movement_type = 'RETURN_RECEIPT'
                   ) THEN quantity
                   ELSE 0 END) AS quantity_sold
        FROM inventory_movements
        GROUP BY inventory_position_id
      )
      SELECT ip.id, ip.organization_id, ip.inventory_number
      FROM inventory_positions ip
      LEFT JOIN movement_deltas md ON md.inventory_position_id = ip.id
      WHERE ip.quantity_received <> COALESCE(md.quantity_received, 0)
         OR ip.quantity_available <> COALESCE(md.quantity_available, 0)
         OR ip.quantity_reserved <> COALESCE(md.quantity_reserved, 0)
         OR ip.quantity_inspection <> COALESCE(md.quantity_inspection, 0)
         OR ip.quantity_defective <> COALESCE(md.quantity_defective, 0)
         OR ip.quantity_sold <> COALESCE(md.quantity_sold, 0)
    `,
  },
];

async function main() {
  const results = [];
  for (const check of CHECKS) {
    const rows = await prisma.$queryRawUnsafe(check.sql);
    results.push({ ...check, rows });
  }

  const failures = results.filter((result) => result.rows.length > 0);
  for (const result of results) {
    const icon = result.rows.length === 0 ? "OK" : result.severity.toUpperCase();
    console.log(`${icon} ${result.name}: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log(JSON.stringify(result.rows.slice(0, 10), stringifyBigInt, 2));
    }
  }

  if (failures.length > 0) {
    console.error(`Integrity check failed: ${failures.length} check(s) reported rows.`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

function stringifyBigInt(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}
