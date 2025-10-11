import { ConnectionSchemaBrowser } from '@/dashboard/components/ConnectionSchemaBrowser';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';

export function ConnectionPreview({
  teamUuid,
  connectionUuid,
  connectionType,
}: {
  teamUuid: string;
  connectionUuid: string;
  connectionType: ConnectionType;
}) {
  const [data, setData] = useState<any>(generateData());

  return (
    <div className={'flex h-full flex-row'}>
      <div className="w-4/12 overflow-y-auto border-r border-border px-0">
        <ConnectionSchemaBrowser
          teamUuid={teamUuid}
          TableQueryAction={({ query }) => <div>Action {query}</div>}
          onTableQueryAction={(query) => setData(generateData())}
          uuid={connectionUuid}
          type={connectionType}
        />
      </div>

      <div className="w-8/12 overflow-auto">
        <table className="table table-auto text-sm">
          <thead>
            <tr className="sticky top-0 border-b border-border bg-white">
              {Object.keys(data[0]).map((key) => (
                <th className="sticky top-0 border-b border-border bg-white px-2 text-left">{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row: any) => (
              <tr>
                {Object.keys(row).map((key) => (
                  <td className="whitespace-nowrap px-2">{row[key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const firstNames = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace'];
const lastNames = ['Smith', 'Johnson', 'Lee', 'Patel', 'Garcia', 'Müller', 'Brown'];
const cities = ['New York', 'London', 'Berlin', 'Tokyo', 'Sydney', 'Toronto', 'Paris'];
const statuses = ['active', 'inactive', 'pending'];
const countries = ['United States', 'Canada', 'United Kingdom', 'Australia', 'France', 'Germany', 'Italy'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomDate(start: Date, end: Date) {
  const ts = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(ts).toISOString().split('T')[0];
}
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateData(rows = 100) {
  const baseKeys = ['id', 'name', 'email', 'age', 'city', 'signupDate', 'status', 'address'] as const;
  const orderedKeys = shuffle([...baseKeys]); // new column order each run

  const data: Record<(typeof baseKeys)[number], unknown>[] = [];
  for (let i = 0; i < rows; i++) {
    const first = randomItem(firstNames);
    const last = randomItem(lastNames);
    const base = {
      id: i + 1,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      age: Math.floor(Math.random() * 40) + 20,
      city: randomItem(cities),
      signupDate: randomDate(new Date(2020, 0, 1), new Date()),
      status: randomItem(statuses),
      address: `${randomItem(cities)}, ${randomItem(countries)}`,
    };

    // Insert properties in the same shuffled order for every row
    const row: any = {};
    for (const k of orderedKeys) row[k] = base[k];
    data.push(row);
  }
  return data;
}
