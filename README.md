# SIEMPRE

Siete letras para siete etapas de los siete años que ya hemos compartido.

El regalo llega cerrado, en un sobre. Al abrirlo aparece la carta, y al final
de la carta se entra al regalo: de lejos se lee SIEMPRE, y al acercarse las
letras resultan estar construidas con fotografías. Al tocar una letra se entra
en su etapa.

Las dos **E** son etapas distintas y tienen identificadores propios
(`etapa-03` y `etapa-07`). Nada se relaciona por la letra, siempre por el
identificador de etapa.

Para cambiar textos, música, nombres o colores: **`CÓMO-EDITAR.md`**.

## Cómo está montado

HTML, CSS y JavaScript sin dependencias ni paso de compilación: se abre tal
cual en cualquier navegador y se publica copiando la carpeta. Las fotografías
se preparan antes con dos guiones de Python.

Se eligió así porque el contenido es estático y cabe entero en archivos, no
hacía falta un servidor ni un armazón que envejezca. No hay ninguna pieza
externa: la web no contacta con ningún tercero.

```
SIEMPRE/
  index.html
  assets/css/siempre.css
  assets/js/
    datos.js      carga y acceso al contenido
    mosaico.js    la palabra, el zoom y el desplazamiento
    album.js      galería (y carta opcional) de cada etapa
    visor.js      la fotografía a pantalla completa
    app.js        el sobre, el recorrido y el botón Atrás
  contenido/      LO QUE TÚ EDITAS
    etapas.json     configuración central de las siete etapas
    carta.txt       la carta de la portada (se publica)
    textos/         una carta por etapa, opcionales (no se publican)
  datos/          generado: no se edita a mano
    fotos.json      inventario de fotografías
    mosaico.json    coordenadas de las teselas de cada letra
    prueba-mosaico.png  vista de control de las siete letras
  medios/         generado: las copias que sirve la web
    etapa-01/micro|mini|medio|grande
  herramientas/   los guiones de preparación
```

Los originales viven fuera, en `../PHOTOS/`, y no se tocan nunca.

## Los cuatro tamaños de cada fotografía

| Nivel | Tamaño | Para qué | Peso total |
|---|---|---|---|
| `micro` | 112 px, cuadrada | la palabra vista de lejos | 3 MB |
| `mini` | 400 px, cuadrada | las teselas al acercarse | 24 MB |
| `medio` | 1400 px | la galería del álbum | 149 MB |
| `grande` | resolución original | el visor | 444 MB |

Sólo `micro` y `mini` se recortan en cuadrado; las demás conservan la
proporción original. El primer vistazo descarga unos 3 MB: sólo el nivel
`micro` de las teselas visibles. Lo nítido llega al acercarse.

El nivel `grande` es **una copia exacta del original**: se copian sus bytes y
se le quitan sólo los metadatos, sin recomprimir. 769 de las 770 fotos pasaron
por ahí; la excepción es un archivo que era un GIF con extensión `.jpg`.

Todas las copias salen sin metadatos, coordenadas GPS incluidas.

## Regenerar

```bash
python3 herramientas/01_preparar_fotos.py    # copias para la web (unos 4 min)
python3 herramientas/02_generar_mosaico.py   # coordenadas de las letras
python3 herramientas/comprobar_js.py         # sintaxis del JavaScript
python3 herramientas/probar_web.py           # recorre la web en un navegador
```

`02_generar_mosaico.py` usa Arial Black únicamente para calcular el molde de
las letras. La tipografía no se distribuye con la web: lo que viaja al
navegador son las coordenadas ya calculadas.

## Ver la web en local

```bash
python3 -m http.server 8000
```

y abrir `http://localhost:8000`. Hace falta un servidor: abriendo el archivo
directamente, el navegador bloquea la lectura de los `.json`.
