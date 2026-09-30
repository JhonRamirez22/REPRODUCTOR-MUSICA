import { describe, expect, it } from 'vitest';
import { DoublyLinkedList } from './doubly-linked-list.js';
import { PlaybackCursor } from './playback-cursor.js';

function queue(size: number): DoublyLinkedList<number> {
  return DoublyLinkedList.from(
    Array.from({ length: size }, (_, index) => ({ id: `track-${index}`, value: index })),
  );
}

describe('PlaybackCursor', () => {
  it('handles an empty queue and a single item', () => {
    const empty = new PlaybackCursor(queue(0));
    expect(empty.current).toBeNull();
    expect(empty.next()).toBeNull();
    expect(empty.prev()).toBeNull();

    const single = new PlaybackCursor(queue(1));
    expect(single.current?.id).toBe('track-0');
    expect(single.next()).toBeNull();
    expect(single.current?.id).toBe('track-0');
    expect(single.prev()).toBeNull();
  });

  it('stops at either end when repeat is off and wraps when repeat is all', () => {
    const cursor = new PlaybackCursor(queue(3));
    expect(cursor.prev()).toBeNull();
    expect(cursor.current?.id).toBe('track-0');
    cursor.jumpTo('track-2');
    expect(cursor.next()).toBeNull();
    expect(cursor.current?.id).toBe('track-2');

    cursor.setRepeat('all');
    expect(cursor.next()?.id).toBe('track-0');
    expect(cursor.prev()?.id).toBe('track-2');
  });

  it('keeps the current node in repeat-one mode', () => {
    const cursor = new PlaybackCursor(queue(3));
    cursor.setRepeat('one');
    expect(cursor.next()?.id).toBe('track-0');
    expect(cursor.prev()?.id).toBe('track-0');
  });

  it('jumps and removes the current node or tail', () => {
    const cursor = new PlaybackCursor(queue(3));
    expect(cursor.jumpTo('track-1')?.id).toBe('track-1');
    expect(cursor.removeById('track-1')).toBe(1);
    expect(cursor.current?.id).toBe('track-2');
    expect(cursor.removeById('track-2')).toBe(2);
    expect(cursor.current?.id).toBe('track-0');
    expect(cursor.removeById('track-0')).toBe(0);
    expect(cursor.current).toBeNull();
    expect(cursor.removeById('missing')).toBeUndefined();
  });

  it('shuffles only the in-memory playback order and can restore source order', () => {
    const source = queue(4);
    const cursor = new PlaybackCursor(source);
    cursor.setShuffle(true, () => 0);
    expect(source.toArray()).toEqual([0, 1, 2, 3]);
    expect(cursor.isShuffled).toBe(true);
    cursor.setShuffle(false);
    expect(cursor.current?.id).toBe('track-0');
    expect(cursor.next()?.id).toBe('track-1');
  });
});
