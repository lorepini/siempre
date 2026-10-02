# Cómo cambiar el contenido de SIEMPRE

Nada de esto exige tocar el código. Después de cualquier cambio:

```bash
git add -A && git commit -m "lo que has cambiado" && git push
```

y en un minuto está en línea.

## El recorrido

Un sobre cerrado → la carta → el botón «Ver regalo» → las siete letras hechas
con vuestras fotos. Desde el mosaico, el botón «Carta» vuelve a abrirla.

## 1. La carta de la portada

Está en **`contenido/carta.txt`**. Texto normal, en UTF-8. Se respetan tus
párrafos y tus saltos de línea: un párrafo nuevo es una línea en blanco.

Si el último párrafo es corto, se muestra como despedida, en el color de
acento y algo más grande. Así se lee ahora «Tu y yo siempre.»

> **Esta carta se publica.** Es lo primero que se ve al abrir el enlace, así
> que cualquiera que lo tenga puede leerla. Es lo que decidiste, pero conviene
> tenerlo presente cada vez que la edites.

## 2. El sobre

En `contenido/etapas.json`, dentro de `proyecto.entrada`:

- `para` — lo que se lee encima del sobre («Para Sapito»)
- `pista` — la línea pequeña de debajo («Ábrelo»)
- `tituloCarta` — un encabezado opcional para la carta; vacío, no aparece
- `firmaCarta` — una firma opcional al pie
- `botonRegalo` — el texto del botón («Ver regalo»)

La letra del sello es la **S** de SIEMPRE y se cambia en
`assets/css/siempre.css`, en `.sobre__sello::after`.

## 3. Nombres y fechas de las etapas

En `contenido/etapas.json`, en cada etapa:

```json
{ "id": "etapa-01", "orden": 1, "letra": "S", "nombre": "Los comienzos", "fechas": "2018 – 2019", ... }
```

Las fechas son opcionales. Mientras `nombre` esté vacío, se muestra «Etapa 1».

**No cambies `id` ni `letra`.** Las dos E tienen identificadores distintos
(`etapa-03` y `etapa-07`) y de eso depende que sus contenidos no se mezclen.

## 4. Cartas por etapa (opcionales)

Además de la carta de la portada, cada etapa puede tener la suya, en
`contenido/textos/etapa-01.txt` … `etapa-07.txt`.

Para que la web las busque, pon `album.cartasPorEtapa` en `true`. Ahora está
en `false` y los siete archivos están vacíos: cada etapa es solo sus fotos.

**Si un archivo está vacío, esa etapa no muestra hueco de carta.**

Estos archivos **no se suben a internet**: están excluidos en `.gitignore`.
Si algún día quieres publicarlos, hay que quitar esa línea, y antes conviene
pensar si el alojamiento abierto sigue siendo lo que quieres.

Con `album.cartaPosicion` eliges si la carta de la etapa va antes (`"inicio"`)
o después (`"final"`) de las fotos. `album.tituloCarta` les pone un
encabezado común a todas.

## 5. El final del recorrido

En `proyecto.cierre`, `titulo` y `texto`. Mientras estén vacíos, la etapa 7
simplemente termina. En cuanto escribas algo, aparece el botón «Final del
recorrido» al pie de la séptima etapa.

`proyecto.mosaico.indicacion` es la línea bajo las letras.

## 6. Colores y tipografía

En `aspecto`. Todo editable: fondo, tinta, acento, tipografías.
`veloColorLejos` tiñe suavemente el mosaico visto de lejos; con `0` está apagado.

## 7. Qué fotos forman cada letra

El reparto lo hace el programa y es estable: al recargar no cambia.

- `favoritas` — identificadores que **siempre** entran en la letra
- `excluirDelMosaico` — fotos que no quieres en la letra (siguen en el álbum)
- `mosaico.semilla` — cambia el número y sale otro reparto
- `mosaico.teselasObjetivo` — cuántas fotos por letra, aproximadamente

Los identificadores son del tipo `etapa-04-0017` y están en `datos/fotos.json`.
Después de tocar cualquiera de esos cuatro:

```bash
python3 herramientas/02_generar_mosaico.py
```

## 8. Añadir o quitar fotografías

Las originales están en la carpeta que indica `origenFotos` en
`contenido/etapas.json`. Añade o quita ahí y vuelve a ejecutar:

```bash
python3 herramientas/01_preparar_fotos.py    # copias para la web
python3 herramientas/02_generar_mosaico.py   # recalcula las letras
```

Los originales no se tocan nunca. Los duplicados exactos se detectan solos y
no se copian, pero tampoco se borran.

## 9. ¿Y la música?

Se quitó a propósito: el regalo va en silencio. El código que la hacía
funcionar (una canción por etapa, con enlaces de YouTube) sigue en el
historial de git, en el commit anterior a su retirada, por si algún día
la quieres de vuelta.
