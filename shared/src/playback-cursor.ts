import { DoublyLinkedList, type ListNode } from './doubly-linked-list.js';

export type RepeatMode = 'off' | 'all' | 'one';

export class PlaybackCursor<T> {
  private navigation: DoublyLinkedList<T>;
  private active: ListNode<T> | null;
  private repeat: RepeatMode = 'off';
  private shuffled = false;

  constructor(private readonly queue: DoublyLinkedList<T>) {
    this.navigation = queue;
    this.active = queue.head;
  }

  get current(): ListNode<T> | null {
    return this.active;
  }

  get repeatMode(): RepeatMode {
    return this.repeat;
  }

  get isShuffled(): boolean {
    return this.shuffled;
  }

  setRepeat(mode: RepeatMode): void {
    this.repeat = mode;
  }

  setShuffle(enabled: boolean, random: () => number = Math.random): void {
    if (enabled === this.shuffled) return;
    const currentId = this.active?.id;
    this.shuffled = enabled;
    if (!enabled) {
      this.navigation = this.queue;
      this.active = currentId ? this.find(this.queue, currentId) : this.queue.head;
      return;
    }

    const remaining = new DoublyLinkedList<T>();
    for (let node = this.queue.head; node; node = node.next) {
      remaining.insertAtTail(node.id, node.value);
    }
    const reordered = new DoublyLinkedList<T>();
    while (remaining.size > 0) {
      const selected = Math.floor(Math.max(0, Math.min(0.999999999, random())) * remaining.size);
      const node = remaining.getAt(selected);
      if (!node) break;
      reordered.insertAtTail(node.id, node.value);
      remaining.removeById(node.id);
    }
    this.navigation = reordered;
    this.active = currentId ? this.find(reordered, currentId) : reordered.head;
  }

  next(): ListNode<T> | null {
    if (!this.active || this.repeat === 'one') return this.active;
    if (this.active.next) {
      this.active = this.active.next;
      return this.active;
    }
    if (this.repeat === 'all') {
      this.active = this.navigation.head;
      return this.active;
    }
    return null;
  }

  prev(): ListNode<T> | null {
    if (!this.active || this.repeat === 'one') return this.active;
    if (this.active.prev) {
      this.active = this.active.prev;
      return this.active;
    }
    if (this.repeat === 'all') {
      this.active = this.navigation.tail;
      return this.active;
    }
    return null;
  }

  jumpTo(id: string): ListNode<T> | null {
    const node = this.find(this.navigation, id);
    if (node) this.active = node;
    return node;
  }

  removeById(id: string): T | undefined {
    const currentId = this.active?.id;
    const navigationNode = this.find(this.navigation, id);
    const wasCurrent = id === currentId;
    const successor = navigationNode?.next ?? (wasCurrent ? (navigationNode?.prev ?? null) : null);
    const value = this.queue.removeById(id);
    if (this.navigation !== this.queue) this.navigation.removeById(id);
    if (wasCurrent) {
      this.active =
        successor && successor.id !== id ? this.find(this.navigation, successor.id) : null;
    } else if (currentId) {
      this.active = this.find(this.navigation, currentId);
    }
    return value;
  }

  private find(list: DoublyLinkedList<T>, id: string): ListNode<T> | null {
    const index = list.indexOf(id);
    return index < 0 ? null : list.getAt(index);
  }
}
