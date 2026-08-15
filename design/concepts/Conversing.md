# Conversing

## Purpose

Arrange items into conversations, with one root and replies that may have replies
of their own.

## Principle

Noor starts a conversation with her question. Omar replies to it, and Priya
replies to Omar. An item can appear in only one conversation, so placing Omar's
answer again is refused. Omar's reply cannot be removed while Priya's reply is
beneath it. Removing the last node also removes the conversation.

## Types

```types
external Item
  An application-owned identity used in the item role.
```

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
start(item: Item, at: Date) : return (conversation: Conversation, node: Node)
  where no node has this item
  then
    add a new conversation with root node and createdAt at
    add a new node with conversation, item, depth 0, and createdAt at
    return conversation, node
  where a node has this item
  then
    refuse ITEM_ALREADY_IN_CONVERSATION "This item is already in a conversation."

reply(item: Item, parent: Node, at: Date) : return (node: Node)
  where parent not in nodes
  then
    refuse PARENT_NODE_NOT_FOUND "There is no such node to reply to."
  where parent in nodes and a node has this item
  then
    refuse ITEM_ALREADY_IN_CONVERSATION "This item is already in a conversation."
  where parent in nodes and no node has this item
  then
    add a new node with conversation the parent's conversation, item, parent,
      depth one more than the parent's depth, and createdAt at
    return node

remove(node: Node) : return (node: Node)
  where node not in nodes
  then
    refuse NODE_NOT_FOUND "There is no such node."
  where another node has node as its parent
  then
    refuse NODE_HAS_CHILDREN "This node has replies beneath it."
  where node in nodes, no node has node as its parent, and another node shares its conversation
  then
    delete node
    return node
  where node in nodes, no node has node as its parent, and no other node shares its conversation
  then
    delete node
    delete its conversation
    return node
```

## Queries

```queries
_getThread (conversation: String) : many (node: String, item: String, parent: String|Null, depth: Number)
  answers the Conversation's Nodes in creation order
  answers no rows when the Conversation has no Nodes or does not exist

_getConversation (node: String) : optional (conversation: String)
  answers the Conversation containing the Node
  answers no row when the Node does not exist

_getNodeByItem (item: String) : optional (node: String)
  answers the Node placing the Item
  answers no row when no Node places the Item

_parentOf (node: String) : optional (parent: String)
  answers the parent of the Node
  answers no row for a root or unknown Node

_getItem (node: String) : optional (item: String)
  answers the Item placed by the Node
  answers no row when the Node does not exist

_hasChildren (node: String) : one (present: Boolean)
  answers whether another Node has this Node as its parent
  answers false for an unknown Node

_getConversations () : many (conversation: String, root: String, item: String, createdAt: Date, lastActivityAt: Date)
  answers conversations newest-created first
  answers no rows when none match

_getConversationsByLastActivity () : many (conversation: String, root: String, item: String, createdAt: Date, lastActivityAt: Date)
  answers conversations with the most recently active first
  answers no rows when none match
```
