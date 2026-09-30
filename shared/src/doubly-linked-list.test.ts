import { describe, expect, it } from 'vitest';
import { DoublyLinkedList, type ListNode } from './doubly-linked-list.js';

function values<T>(list: DoublyLinkedList<T>): T[] {
  const items: T[] = [];
  for (let node = list.head; node; node = node.next) items.push(node.value);
  return items;
}

function expectInvariants<T>(list: DoublyLinkedList<T>, expected: T[]): void {
  expect(list.size).toBe(expected.length);
  expect(list.head?.prev ?? null).toBeNull();
  expect(list.tail?.next ?? null).toBeNull();
  expect(values(list)).toEqual(expected);

  const backwards: T[] = [];
  for (let node = list.tail; node; node = node.prev) backwards.push(node.value);
  expect(backwards).toEqual([...expected].reverse());
}

describe('DoublyLinkedList', () => {
  it('supports empty and single-node transitions at both ends', () => {
    const list = new DoublyLinkedList<string>();
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
    expect(list.getAt(0)).toBeNull();
    expectInvariants(list, []);

    const node = list.insertAtHead('one', 'first');
    expect(node.prev).toBeNull();
    expect(node.next).toBeNull();
    expect(list.head).toBe(node);
    expect(list.tail).toBe(node);
    expectInvariants(list, ['first']);

    expect(list.removeById('one')).toBe('first');
    expect(node.prev).toBeNull();
    expect(node.next).toBeNull();
    expectInvariants(list, []);
    list.insertAtTail('again', 'second');
    expectInvariants(list, ['second']);
  });

  it('inserts at the head, tail, and any valid index', () => {
    const list = new DoublyLinkedList<string>();
    list.insertAtHead('b', 'B');
    list.insertAtTail('d', 'D');
    list.insertAt(1, 'c', 'C');
    list.insertAt(0, 'a', 'A');
    list.insertAt(list.size, 'e', 'E');
    expectInvariants(list, ['A', 'B', 'C', 'D', 'E']);
    expect(list.getAt(2)?.id).toBe('c');
    expect(list.getAt(-1)).toBeNull();
    expect(list.getAt(list.size)).toBeNull();
    expect(() => list.insertAt(6, 'bad', 'invalid')).toThrow(RangeError);
    expect(() => list.insertAt(1.2, 'bad', 'invalid')).toThrow(RangeError);
    expect(() => list.insertAt(0, 'a', 'duplicate')).toThrow('already exists');
  });

  it('removes a middle node, each endpoint, and reports missing IDs', () => {
    const list = DoublyLinkedList.from([
      { id: 'a', value: 'A' },
      { id: 'b', value: 'B' },
      { id: 'c', value: 'C' },
      { id: 'd', value: 'D' },
    ]);
    const removed = list.getAt(2) as ListNode<string>;
    expect(list.removeById('c')).toBe('C');
    expect(removed.prev).toBeNull();
    expect(removed.next).toBeNull();
    expectInvariants(list, ['A', 'B', 'D']);
    expect(list.removeById('a')).toBe('A');
    expectInvariants(list, ['B', 'D']);
    expect(list.removeById('d')).toBe('D');
    expectInvariants(list, ['B']);
    expect(list.removeById('missing')).toBeUndefined();
    expect(list.removeById('b')).toBe('B');
    expectInvariants(list, []);
  });

  it('moves nodes without losing links or changing size', () => {
    const list = DoublyLinkedList.from(['a', 'b', 'c', 'd'].map((value) => ({ id: value, value })));
    list.moveTo('a', 3);
    expectInvariants(list, ['b', 'c', 'd', 'a']);
    list.moveTo('a', 0);
    expectInvariants(list, ['a', 'b', 'c', 'd']);
    list.moveTo('b', 2);
    expectInvariants(list, ['a', 'c', 'b', 'd']);
    list.moveTo('b', 2);
    expectInvariants(list, ['a', 'c', 'b', 'd']);
    expect(() => list.moveTo('missing', 1)).toThrow(RangeError);
    expect(() => list.moveTo('a', 4)).toThrow(RangeError);
  });

  it('keeps invariants through 500 deterministic mixed operations', () => {
    let seed = 8675309;
    const random = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    const list = new DoublyLinkedList<number>();
    const reference: Array<{ id: string; value: number }> = [];
    let nextId = 0;

    for (let step = 0; step < 500; step += 1) {
      const action = Math.floor(random() * 4);
      if (action <= 1 || reference.length === 0) {
        const id = `node-${nextId}`;
        const value = nextId;
        nextId += 1;
        const index = Math.floor(random() * (reference.length + 1));
        if (index === 0) list.insertAtHead(id, value);
        else if (index === reference.length) list.insertAtTail(id, value);
        else list.insertAt(index, id, value);
        reference.splice(index, 0, { id, value });
      } else if (action === 2) {
        const index = Math.floor(random() * reference.length);
        const item = reference[index];
        if (item) expect(list.removeById(item.id)).toBe(item.value);
        reference.splice(index, 1);
      } else {
        const from = Math.floor(random() * reference.length);
        const to = Math.floor(random() * reference.length);
        const item = reference.splice(from, 1)[0];
        if (item) {
          reference.splice(to, 0, item);
          list.moveTo(item.id, to);
        }
      }
      expectInvariants(
        list,
        reference.map((item) => item.value),
      );
    }
  });
});
