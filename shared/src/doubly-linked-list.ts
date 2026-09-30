export class ListNode<T> {
  constructor(
    public readonly id: string,
    public value: T,
    public prev: ListNode<T> | null = null,
    public next: ListNode<T> | null = null,
  ) {}
}

export class DoublyLinkedList<T> {
  private first: ListNode<T> | null = null;
  private last: ListNode<T> | null = null;
  private readonly nodes = new Map<string, ListNode<T>>();
  private count = 0;

  get size(): number {
    return this.count;
  }

  get head(): ListNode<T> | null {
    return this.first;
  }

  get tail(): ListNode<T> | null {
    return this.last;
  }

  insertAtHead(id: string, value: T): ListNode<T> {
    this.assertUniqueId(id);
    const node = new ListNode(id, value, null, this.first);
    if (this.first) this.first.prev = node;
    else this.last = node;
    this.first = node;
    this.nodes.set(id, node);
    this.count += 1;
    return node;
  }

  insertAtTail(id: string, value: T): ListNode<T> {
    this.assertUniqueId(id);
    const node = new ListNode(id, value, this.last, null);
    if (this.last) this.last.next = node;
    else this.first = node;
    this.last = node;
    this.nodes.set(id, node);
    this.count += 1;
    return node;
  }

  insertAt(index: number, id: string, value: T): ListNode<T> {
    this.assertIndex(index, this.count);
    if (index === 0) return this.insertAtHead(id, value);
    if (index === this.count) return this.insertAtTail(id, value);

    this.assertUniqueId(id);
    const right = this.nodeAt(index);
    if (!right) throw new RangeError('Index is outside the list.');
    const left = right.prev;
    const node = new ListNode(id, value, left, right);
    if (left) left.next = node;
    right.prev = node;
    this.nodes.set(id, node);
    this.count += 1;
    return node;
  }

  removeById(id: string): T | undefined {
    const node = this.nodes.get(id);
    if (!node) return undefined;

    if (node.prev) node.prev.next = node.next;
    else this.first = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.last = node.prev;

    this.nodes.delete(id);
    this.count -= 1;
    node.prev = null;
    node.next = null;
    return node.value;
  }

  moveTo(id: string, toIndex: number): void {
    this.assertIndex(toIndex, this.count - 1);
    const fromIndex = this.indexOf(id);
    if (fromIndex < 0) throw new RangeError('Node does not exist in the list.');
    if (fromIndex === toIndex) return;

    const node = this.nodes.get(id);
    if (!node) throw new RangeError('Node does not exist in the list.');
    if (node.prev) node.prev.next = node.next;
    else this.first = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.last = node.prev;
    this.count -= 1;
    node.prev = null;
    node.next = null;

    if (toIndex === 0) {
      node.next = this.first;
      if (this.first) this.first.prev = node;
      else this.last = node;
      this.first = node;
    } else if (toIndex === this.count) {
      node.prev = this.last;
      if (this.last) this.last.next = node;
      else this.first = node;
      this.last = node;
    } else {
      const right = this.nodeAt(toIndex);
      if (!right) throw new RangeError('Index is outside the list.');
      node.prev = right.prev;
      node.next = right;
      if (right.prev) right.prev.next = node;
      right.prev = node;
    }
    this.count += 1;
  }

  getAt(index: number): ListNode<T> | null {
    if (!Number.isInteger(index) || index < 0 || index >= this.count) return null;
    return this.nodeAt(index);
  }

  indexOf(id: string): number {
    let index = 0;
    for (let node = this.first; node; node = node.next, index += 1) {
      if (node.id === id) return index;
    }
    return -1;
  }

  toArray(): T[] {
    const items: T[] = [];
    for (let node = this.first; node; node = node.next) items.push(node.value);
    return items;
  }

  static from<T>(items: Iterable<{ id: string; value: T }>): DoublyLinkedList<T> {
    const list = new DoublyLinkedList<T>();
    for (const item of items) list.insertAtTail(item.id, item.value);
    return list;
  }

  private nodeAt(index: number): ListNode<T> | null {
    if (index < 0 || index >= this.count) return null;
    if (index <= this.count / 2) {
      let node = this.first;
      for (let cursor = 0; cursor < index; cursor += 1) node = node?.next ?? null;
      return node;
    }
    let node = this.last;
    for (let cursor = this.count - 1; cursor > index; cursor -= 1) node = node?.prev ?? null;
    return node;
  }

  private assertUniqueId(id: string): void {
    if (this.nodes.has(id)) throw new Error(`A node with id "${id}" already exists.`);
  }

  private assertIndex(index: number, max: number): void {
    if (!Number.isInteger(index) || index < 0 || index > max) {
      throw new RangeError(`Index must be an integer between 0 and ${max}.`);
    }
  }
}
