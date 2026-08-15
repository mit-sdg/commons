# Post links

Creating or editing a post parses each nonempty value inside `[[...]]` and
replaces that source's ordered forward-link list. Link values are treated as
post identities; saving content does not verify that a target exists.

For a readable source, [Forum.links.Forward](reaction:Forum.links.Forward) returns only linked targets that
are also currently readable. For a readable target,
[Forum.links.Backlinks](reaction:Forum.links.Backlinks) returns only readable source posts. Trashing either
side hides the corresponding row, and restore can reveal the retained link.

Post refresh reactions replace only the source's forward links, which also
changes derived backlinks. Ordinary deletion and permanent purge clear links
from the deleted source and references to it from every other source. Those
cleanup actions are independent of the post transition, so a fault can leave
unexposed link state until repaired.

## Supporting declarations

Formers [theBacklinksOf](former:Forum.links.theBacklinksOf), [theForwardLinksOf](former:Forum.links.theForwardLinksOf) support the behavior and result shapes described above.
