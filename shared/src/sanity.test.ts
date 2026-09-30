import { describe, expect, it } from 'vitest';
import { DoublyLinkedList } from './index.js';

describe('shared workspace', () => {
  it('exports a working linked list', () => {
    expect(DoublyLinkedList.from([{ id: 'smoke', value: 'linked' }]).toArray()).toEqual(['linked']);
  });
});
