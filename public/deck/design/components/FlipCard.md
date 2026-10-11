# FlipCard

The card at the top of card detail is a real 3D object.

- It tilts up to about 10 degrees towards the pointer (mouse only; on touch it stays flat so scrolling is never blocked).
- Tapping flips it 180 degrees (620ms, `ease-snap`) to the card record: card number, source, where it was made, the rule and how often it was found.
- Front and back share one size; the back is `night` with white text.
- With Reduce Motion the flip is a cross-fade.
