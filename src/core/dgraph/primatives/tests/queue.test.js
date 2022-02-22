import Queue from "../queue/queue";

describe("Queue unit tests", () => {
  let queue;

  describe("new Queue()", () => {
    it("creates an empty queue", () => {
      queue = new Queue();
    });
  });

  describe("Queue.fromArray(list)", () => {
    it("creates a queue from an existing array", () => {
      const q = Queue.fromArray([1, 2, 3]);
      expect(q.front()).toEqual(1);
      expect(q.size()).toEqual(3);
    });
  });

  describe(".enqueue(element)", () => {
    it("should enqueue 3 elements to the stack", () => {
      queue.enqueue(1);
      queue.enqueue(8);
      queue.enqueue(45);
    });
  });

  describe(".size()", () => {
    it("should have size of 3", () => {
      expect(queue.size()).toEqual(3);
    });
  });

  describe(".front()", () => {
    it("should peek the front element", () => {
      expect(queue.front()).toEqual(1);
    });
  });

  describe(".back()", () => {
    it("should peek the back element", () => {
      expect(queue.back()).toEqual(45);
    });
  });

  describe(".isEmpty()", () => {
    it("should not be empty", () => {
      expect(queue.isEmpty()).toEqual(false);
    });
  });

  describe(".clone()", () => {
    it("clone a queue", () => {
      queue.dequeue();

      const clone = queue.clone();
      clone.dequeue();

      expect(clone.front()).toEqual(45);
      expect(clone.size()).toEqual(1);
      //   expect(queue.front(8));
      expect(queue.size()).toEqual(2);
    });
  });

  describe("toArray()", () => {
    it("should convert the queue into an array", () => {
      expect(queue.toArray()).toEqual([8, 45]);
    });
  });

  describe("dequeue()", () => {
    it("should dequeue all elements", () => {
      expect(queue.dequeue()).toEqual(8);
      expect(queue.dequeue()).toEqual(45);
    });
  });

  describe(".clear()", () => {
    it("should clear the queue", () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);
      queue.clear();
      expect(queue.dequeue()).toEqual(null);
      expect(queue.front()).toEqual(null);
      expect(queue.back()).toEqual(null);
      expect(queue.size()).toEqual(0);
      expect(queue.isEmpty()).toEqual(true);
    });
  });
});
