import { RefreshIcon } from '@/shared/components/Icons';
import { Button, VARIANT_MAP } from '@/shared/shadcn/ui/button';
const variants = Object.keys(VARIANT_MAP) as Array<keyof typeof VARIANT_MAP>;

export default function Component() {
  return (
    <table>
      <thead>
        <tr>
          <th>Variant</th>
          <th>Disabled</th>
          <th>Loading</th>
        </tr>
      </thead>
      {variants.map((variant) => (
        <tr key={variant}>
          <td className="p-2">
            <Button variant={variant} className="capitalize">
              {variant}
            </Button>
          </td>
          <td className="p-2">
            <Button variant={variant} disabled className="capitalize">
              {variant}
            </Button>
          </td>
          <td className="p-2">
            <Button variant={variant} loading className="capitalize">
              {variant}
            </Button>
          </td>
        </tr>
      ))}
      {variants.map((variant) => (
        <tr key={variant}>
          <td className="p-2">
            <Button size="icon" variant={variant}>
              <RefreshIcon />
            </Button>
          </td>
          <td className="p-2">
            <Button size="icon" variant={variant} disabled>
              <RefreshIcon />
            </Button>
          </td>
          <td className="p-2">
            <Button size="icon" variant={variant} loading>
              <RefreshIcon />
            </Button>
          </td>
        </tr>
      ))}
    </table>
  );
}
