import { requireOrg } from "@/lib/org";
import { formatEuro } from "@/lib/calculations";
import { ProductDialog } from "@/components/products/product-dialog";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { db } = await requireOrg();
  const { q } = await searchParams;

  const products = await db.product.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { variant: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { ean: { contains: q } },
          ],
        }
      : undefined,
    orderBy: [{ name: "asc" }, { variant: "asc" }],
    take: 500,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Produkte</h1>
          <p className="text-sm text-muted-foreground">
            Wiederkehrende Produkte – im Lager und Verkauf als Vorlage wählbar
          </p>
        </div>
        <ProductDialog />
      </div>

      <form method="GET" className="max-w-sm">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Suche: Name, Variante, Kategorie, EAN…"
          className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
        />
      </form>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Variante/Version</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>EAN</TableHead>
                <TableHead className="text-right">Standard-EK</TableHead>
                <TableHead>Bild</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {q
                      ? "Kein Produkt passt zur Suche."
                      : "Noch keine Produkte im Katalog. Lege wiederkehrende Produkte an, um sie beim Wareneingang und Verkauf per Klick zu übernehmen."}
                  </TableCell>
                </TableRow>
              )}
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.variant ?? "–"}</TableCell>
                  <TableCell>{product.category ?? "–"}</TableCell>
                  <TableCell className="font-mono text-xs">{product.ean ?? "–"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {product.defaultPriceCents !== null
                      ? formatEuro(product.defaultPriceCents)
                      : "–"}
                  </TableCell>
                  <TableCell>
                    {product.imageUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrls[0]}
                        alt={product.name}
                        className="size-9 rounded object-cover"
                      />
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <ProductDialog
                        product={{
                          id: product.id,
                          name: product.name,
                          variant: product.variant ?? "",
                          category: product.category ?? "",
                          ean: product.ean ?? "",
                          defaultPriceCents: product.defaultPriceCents,
                        }}
                      />
                      <DeleteProductButton productId={product.id} name={product.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
