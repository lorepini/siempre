# Cómo cambiar el contenido de SIEMPRE

Nada de esto exige tocar el código. Después de cualquier cambio de los que
aparecen aquí, basta con volver a subir el proyecto.

## 1. Poner nombre y fechas a cada etapa

Abre `contenido/etapas.json` y rellena `nombre` y `fechas` de cada etapa:

```json
{ "id": "etapa-01", "orden": 1, "letra": "S", "nombre": "Los comienzos", "fechas": "2018 – 2019", ... }
```

Las fechas son opcionales: si las dejas vacías, no aparece nada.
Mientras `nombre` esté vacío, la web muestra «Etapa 1».

**No cambies `id` ni `letra`.** Las dos E tienen identificadores distintos
(`etapa-03` y `etapa-07`) y de eso depende que sus contenidos no se mezclen.

## 2. Escribir las cartas

Una carta por etapa, en `contenido/textos/`:

- `etapa-01.txt` … `etapa-07.txt`
- Texto normal, en UTF-8. Se respetan tus párrafos y tus saltos de línea.
- Un párrafo nuevo = una línea en blanco entre medias.
- Mientras el archivo esté vacío, la web avisa de que la carta está pendiente,
  sin inventarse nada.

Por defecto la carta aparece **al principio** de la etapa y las fotos después.
Si algún día prefieres lo contrario, cambia en `contenido/etapas.json`:
`"album": { "cartaPosicion": "final" }`.

El título de todas las cartas se cambia en `"tituloCarta"`.

## 3. Poner la música

Una canción por etapa. Lo más sencillo es un enlace de YouTube:

```json
"cancion": {
  "titulo": "Nombre de la canción",
  "artista": "Quien la canta",
  "youtube": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
  "archivo": ""
}
```

Vale cualquiera de estos formatos: el enlace largo, el corto `youtu.be/…`
o sólo el identificador.

Si algún día tienes archivos propios (sin derechos de terceros), déjalos en
`contenido/musica/`, pon el nombre del archivo en `"archivo"` y cambia
`"audio": { "motor": "archivo" }`.

Cuándo empieza a sonar se controla con `"arrancaEn"`:

- `"fotos"` — al pasar de la carta a las fotografías *(lo que hay puesto)*
- `"album"` — nada más entrar en la etapa
- `"mosaico"` — al acercarse a la letra, sin entrar

Una etapa sin canción funciona igual, simplemente sin música.

## 4. Textos de la portada y del final

En `contenido/etapas.json`, dentro de `"proyecto"`:

- `portada.frase` — el texto grande de entrada
- `portada.indicacion` — la línea pequeña bajo el mosaico
- `portada.textoIntro` — un párrafo opcional en la portada
- `cierre.titulo` y `cierre.texto` — el final del recorrido

Mientras `cierre` esté vacío, la etapa 7 termina sin pantalla de cierre. En
cuanto escribas algo ahí, aparece el botón «Final del recorrido».

`firma` es lo que se ve al pie de cada carta.

## 5. Colores y tipografía

En `"aspecto"`. Todo es editable: fondo, tinta, acento, tipografías.
`veloColorLejos` tiñe suavemente el mosaico visto de lejos; con `0` está apagado.

## 6. Elegir qué fotos forman cada letra

El reparto lo hace el programa y es estable: al recargar no cambia.

- `favoritas`: lista de identificadores que **siempre** entran en la letra.
- `excluirDelMosaico`: fotos que no quieres ver en la letra (siguen en el álbum).
- `mosaico.semilla`: cambia el número y sale otro reparto distinto.
- `mosaico.teselasObjetivo`: cuántas fotos por letra, aproximadamente.

Los identificadores tienen la forma `etapa-04-0017` y están en `datos/fotos.json`.

Después de tocar cualquiera de estos cuatro, hay que regenerar el mosaico:

```bash
python3 herramientas/02_generar_mosaico.py
```

## 7. Añadir o quitar fotografías

Las fotos originales viven en `../PHOTOS/`, en las carpetas `18-19` … `25-26`.
Añade o quita ahí y vuelve a ejecutar:

```bash
python3 herramientas/01_preparar_fotos.py    # prepara las copias para la web
python3 herramientas/02_generar_mosaico.py   # recalcula las letras
```

Los originales no se tocan nunca. Los duplicados exactos se detectan solos y
no se copian, pero tampoco se borran de su carpeta.
