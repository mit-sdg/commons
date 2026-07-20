# Conversing

## Purpose

Arrange items into conversations, with one root and replies that may have replies
of their own.

## Principle

Noor starts a conversation with her question. Omar replies to it, and Priya
replies to Omar. An item can appear in only one conversation, so placing Omar's
answer again is refused. Omar's reply cannot be removed while Priya's reply is
beneath it. Removing the last node also removes the conversation.

## State

```state
a seq of Conversations with
  a root      Node
  a createdAt Date

a seq of Nodes with
  a conversation    Conversation
  an item           Item
  an optional parent Node
  a depth           Number
  a createdAt       Date
```

Each node places one item in one conversation. A node with a parent is a reply, one level deeper than its parent; a node without a parent is the root of its conversation. Both conversations and nodes keep their creation order.

## Actions

```actions
start (item: Item, at: Date) : return (conversation: Conversation, node: Node), refuse (message: String)
  where no node has this item
  then
    add a new conversation with root node and createdAt at
    add a new node with conversation, item, depth 0, and createdAt at
    return conversation and node
  where a node has this item
  then
    refuse "This item is already in a conversation."

reply (item: Item, parent: Node, at: Date) : return (node: Node), refuse (message: String)
  where parent not in nodes
  then
    refuse "There is no such node to reply to."
  where parent in nodes and a node has this item
  then
    refuse "This item is already in a conversation."
  where parent in nodes and no node has this item
  then
    add a new node with conversation the parent's conversation, item, parent,
      depth one more than the parent's depth, and createdAt at
    return node

remove (node: Node) : return (), refuse (message: String)
  where node not in nodes
  then
    refuse "There is no such node."
  where another node has node as its parent
  then
    refuse "This node has replies beneath it."
  where node in nodes, no node has node as its parent, and another node shares its conversation
  then
    delete node
    return
  where node in nodes, no node has node as its parent, and no other node shares its conversation
  then
    delete node
    delete its conversation
    return
```

## Questions

- `_getThread (conversation)` answers its nodes in creation order.
- `_getConversation (node)`, `_getNodeByItem (item)`, `_parentOf (node)`, and
  `_getItem (node)` each answer at most one row.
- `_hasChildren (node)` answers exactly one row with `present`.
- `_getConversations ()` answers conversations newest-created first.
- `_getConversationsByLastActivity ()` answers conversations with the most
  recently active first.
