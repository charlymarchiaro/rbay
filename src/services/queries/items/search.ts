import {client} from "$services/redis";
import {itemsIndexKey} from "$services/keys";
import {deserialize} from "$services/queries/items/deserialize";

export const searchItems = async (term: string, size: number = 5) => {
  const cleanedTerm = term
     .replaceAll(/[^a-zA-Z0-9 ]/g, '')
     .split(' ')
     .map(word => word ? `%${word}%` : '')
     .join(' ');

  if (cleanedTerm === '') {
    return [];
  }

  const query = `(@name:(${cleanedTerm}) => { $weight: 5.0 }) | (@description:(${cleanedTerm}))`;

  const results = await client.ft.search(
     itemsIndexKey(),
     query,
     {
       LIMIT: {
         from: 0,
         size,
       },
     },
  )

  return results.documents.map(({id, value}) => deserialize(id, value as any));
};
