# KHYAA (ख्याः)

*Some things have lived with your family longer than you have.*

A first-person psychological folklore horror game set in an old Newari family house in Kathmandu.
There is no dialogue and no voice acting. The story is told only through the house: newspapers,
handwritten notes, photographs, a child's drawings, and objects that move when you aren't looking.

## Play

Open `index.html` in a browser. There is no build step and nothing to install.
Headphones are recommended, because the rain, creaks and footsteps are part of the game.

| Action  | Keyboard               | Touch / mouse                       |
|---------|------------------------|-------------------------------------|
| Move    | WASD / arrow keys      | Tap or click where you want to go   |
| Examine | E, Space or Enter      | Tap the object, or the Examine button |
| Mute    | M                      | ♪ button                            |

## Structure

- Seven chapters: The House, Nisha's Room, The Newspaper, The Upstairs Room, The Family,
  The Sixth Member, Dinner
- Three endings: The Departure, The Sixth Member, The House Remembers
- The game never explains the Khyaa. You finish with a theory, not an answer.

All the art is drawn in code at runtime: the house, lantern lighting, sepia photographs, newspaper
halftones and crayon drawings. The audio (rain, thunder, drone, creaks) is synthesised with the Web Audio API.

`index.html?chapter=N` (where N is 1 to 7) jumps straight to a chapter, for testing.

*This is a work of fiction. The newspaper reports, family history and supernatural events are invented.*
