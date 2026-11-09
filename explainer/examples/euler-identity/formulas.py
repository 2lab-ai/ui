"""Formulas for this video: id -> (matplotlib mathtext, colour spec).
Colour spec: {char: colour} ('_' = default for the rest) or {'runs': [colour per glyph]}. Colours are theme names."""
G, B, Y, T, W, R, P, O = 'green', 'blue', 'yellow', 'teal', 'white', 'red', 'purple', 'orange'

# id: (mathtext, color spec). Color spec: dict char->color (default white) and optional
# 'runs' = list of colors per glyph index (overrides), rect color 'rc'.
F = {
  'identity':  (r'$e^{i\pi}+1=0$', {'e': G, 'i': B, 'π': Y}),
  'eipi':      (r'$e^{i\pi}=-1$', {'e': G, 'i': B, 'π': Y}),
  'euler':     (r'$e^{i\theta}=\cos\theta+i\,\sin\theta$', {'runs': [G, B, Y, W, T, T, T, Y, W, B, B, B, B, Y]}),
  'euler_pi':  (r'$e^{i\pi}=\cos\pi+i\,\sin\pi$', {'runs': [G, B, Y, W, T, T, T, Y, W, B, B, B, B, Y]}),
  'pi_val':    (r'$\pi=3.14159\ldots$', {'π': Y}),
  'e_val':     (r'$e=2.71828\ldots$', {'e': G}),
  'ixi':       (r'$i\times i=-1$', {'i': B}),
  'qq':        (r'$?\times ?=-1$', {'?': B}),
  'sq_pos':    (r'$2\times 2=4$', {}),
  'sq_neg':    (r'$(-2)\times(-2)=4$', {}),
  'cubic':     (r'$x^3=15x+4$', {}),
  'cardano':   (r'$\sqrt[3]{2+11i}+\sqrt[3]{2-11i}$', {'i': B}),
  'bombelli':  (r'$(2+i)+(2-i)=4$', {'i': B}),
  'series':    (r'$e^{x}=1+x+\frac{x^2}{2}+\frac{x^3}{6}+\frac{x^4}{24}+\cdots$', {'e': G}),
  't0': (r'$1$', {'_': T}), 't1': (r'$+i\theta$', {'_': B, 'θ': Y}),
  't2': (r'$-\frac{\theta^2}{2}$', {'_': T, 'θ': Y}), 't3': (r'$-i\frac{\theta^3}{6}$', {'_': B, 'θ': Y}),
  't4': (r'$+\frac{\theta^4}{24}$', {'_': T, 'θ': Y}), 't5': (r'$+i\frac{\theta^5}{120}$', {'_': B, 'θ': Y}),
  't6': (r'$-\frac{\theta^6}{720}$', {'_': T, 'θ': Y}), 't7': (r'$\cdots$', {'_': W}),
  'xi':        (r'$x \;\to\; i\theta$', {'runs': [W, W, B, Y]}),
  'cos_lab':   (r'$\cos\theta$', {'_': T, 'θ': Y}),
  'sin_lab':   (r'$i\,\sin\theta$', {'_': B, 'θ': Y}),
  'minus1':    (r'$-1$', {}), 'one': (r'$1$', {}), 'i_sym': (r'$i$', {'i': B}), 'mi': (r'$-i$', {'i': B}),
  'pi_sym':    (r'$\pi$', {'π': Y}), 'e_sym': (r'$e$', {'e': G}), 'theta': (r'$\theta$', {'θ': Y}),
  'zero':      (r'$0$', {}), 'times_i': (r'$\times i$', {'i': B}),
  'half':      (r'$e^{i\pi}$', {'e': G, 'i': B, 'π': Y}),
  'e_i':       (r'$e^{\,i\,?}$', {'e': G, 'i': B, '?': B}),
  'e1': (r'$e^{1}$', {'e': G}), 'e2': (r'$e^{2}$', {'e': G}),
}

