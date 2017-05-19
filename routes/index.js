var express = require('express');
var router = express.Router();
var cheerio = require('cheerio');
var request = require('request');
const crypto = require('crypto');
var base64 = require('node-base64-image');
var utf = require('utf8');
/*----------------LIBRERIAS---------------------*/

var sess; //aqui guardamos las sessiones del usuario
/*---------AQUI ESTAN LAS FUNCIONES PARA HACER SCRAPING----------------- */
var anios = 1948;

/**
 * Creamos la primera promesa donde se creara el nuevo hilo del año generado
 * @returns {Array} infoPersonas
 */
var pillarElementos = function (anios2) {
  return new Promise((resolve, reject) => {
    let arrayElementos = [];
    let arrayImagenes = [];
    var objetoElementos = {};
    var aux = 0;
    request('http://www.christophemaetz.fr/philatelie/basededonnees/?p=be&d=' + anios2, function (err, response, html) {
      var $ = cheerio.load(html);
      if ($('td[align="right"]').length == 0) {
        (anios++);
        return reject("Nada aqui no hay sellos");
      }
      $('td[align="right"]').each(function (i, element) {
        var a = $(this);
        arrayElementos.push(a.text());
      });
      $('#myTable>tbody>tr>td>img').each(function () {
        var b = $(this);
        arrayImagenes.push(b[0].attribs.src);
      });
      objetoElementos.elementos = arrayElementos;
      objetoElementos.imagenes = arrayImagenes;
      objetoElementos.anio = anios2;
      return resolve(objetoElementos);
    });
  });
};

/**
 * ingresaremos en la base de datos los elementos que nos ha devuelto la promesa generadora superior
 * @param {*} req 
 * @param {*} arrayElementos 
 */

var guardarElementos = function (req, arrayElementos) {
  var aux4 = 0;
  var x = 0;
  setInterval(() => {
    if (x == arrayElementos.imagenes.length) {
      return clearInterval();
    }
    try {
      req.getConnection(function (err, conn) {
        if (err) {
          console.error('SQL Connection error: ', err);
          return next(err);
        } else {
          base64.encode(arrayElementos.imagenes[x], {
            string: true
          }, (err, resultado) => {
            let sello = {
              any: arrayElementos.anio,
              imatge: resultado,
              yvert: arrayElementos.elementos[1 + aux4],
              michel: arrayElementos.elementos[2 + aux4],
              scott: arrayElementos.elementos[3 + aux4],
              cob: arrayElementos.elementos[3 + aux4]
            }
            conn.query('INSERT INTO be (any,imatge,yvert,michel,scott,cob) values (?,?,?,?,?)', [sello.any, sello.imatge, sello.yvert, sello.michel, sello.scott, sello.cob], function (err, rows, fields) {
              if (err) {
                console.error('SQL error: ', err);
                return next(err);
              }
            });
          });
          aux4 = aux4 + 4;
          (x++);
        }
      });
    } catch (ex) {
      console.error("Internal error:" + ex);
      return next(ex);
    }
  }, 1000);
  console.log("Año terminado: " + anios);
  (anios++);
};

router.get('/scrap', function (req, res) {
  setInterval(() => {
    pillarElementos(anios).then(x => guardarElementos(req, x)).catch(err => console.log(err));
  }, 15000);
});

/*----------AQUI ACABA LOS METODOS DE SCRAPING------------------------- */
var auth = function (req, res, next) {
  if (sess == undefined)
    return res.sendStatus(401);
  if (sess.user != "")
    return next();
  else
    return res.sendStatus(401);
};

router.get('/', auth, function (req, res, next) {
  res.render('index', {
    title: 'Jose',
    user: sess.user
  });
});

/*Login y salida de usuarios*/
router.get('/logout', auth, function (req, res) {
  sess.user = "";
  res.send("Hasta la próxima!");
});

router.get('/login', function (req, res) {
  res.render('login');
});

router.post('/login', function (req, res) {
  req.getConnection(function (err, conn) {
    if (err) {
      console.error('SQL Connection error:', err);
      return next(err);
    } else {
      const pass = crypto.createHash('sha1').update(req.body.password).digest("hex");
      conn.query('SELECT username from usuaris where email="' + req.body.email + '" and password="' + pass + '"', function (err, row, fields) {
        if (err) {
          console.error('SQL error: ', err);
          return next(err);
        } else {
          if (row.length == 1) {
            sess = req.session;
            sess.user = row[0].username;
            console.log(sess.user);
            console.log("bienvenido " + sess.user);
            res.redirect('/');
          } else {
            console.log("no has entrado");
          }
        }
      });
    }
  });
});
/*Aqui acaba el login y el logut de usuarios*/

/*Registro de usuarios*/
router.get('/register', function (req, res) {
  res.render('register');
});

router.post('/register', function (req, res) {
  console.log(req.body);
  const pass = crypto.createHash('sha1').update(req.body.password).digest("hex");
  console.log(pass);
  req.getConnection(function (err, conn) {
    if (err) {
      console.log('SQL Connection error:', err);
      return next(err);
    } else {
      conn.query('SELECT email from usuaris where email=' + '"' + req.body.email + '"', function (err, row, fields) {
        if (err) {
          console.error('SQL error: ', err);
          return next(err);
        }
        if (row.length != 0) res.render('register', {
          error: true
        });
        else {
          const usuario = {
            username: req.body.username,
            password: pass,
            email: req.body.email
          };
          conn.query('INSERT into usuaris SET ?', usuario, function (err, row, fields) {
            if (err) {
              console.error('SQL error: ', err);
              return next(err);
            }
            res.redirect('mostrar');
          });
        }
      });
    }
  });
});
/*Aqui acaba el registro de usuarios*/

router.post('/anadir', auth ,function (req, res, next) {
  console.log(sess.user);
  console.log(req.body.imagen.indexOf(/\d/));
  var indice_siglas = req.body.imagen.search(/\d/);
  var siglas = req.body.imagen.substring(0,indice_siglas);
  try {
    req.getConnection(function (err, conn) {
      if (err) {
        console.error('SQL Connection error: ', err);
        return next(err);
      } else {
        conn.query(`insert into sellosUsuario values("${req.body.imagen}",1,"${siglas}")`, function (err, rows, fields) {
          if (err) {
            console.error('SQL error: ', err);
            return next(err);
          }
        });
      }
    });
  } catch (ex) {
    console.error("Internal error:" + ex);
    return next(ex);
  }
});

router.get('/mostrar/:id', auth ,function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  try {
    req.getConnection(function (err, conn) {
      if (err) {
        console.error('SQL Connection error: ', err);
        return next(err);
      } else {
        conn.query(`select * from ${req.url.split("/")[2]} limit 40`, function (err, rows, fields) {
          if (err) {
            console.error('SQL error: ', err);
            return next(err);
          }
          var resSello = [];
          for (var sello in rows) {
            var sellos = rows[sello];
            sellos.imatge = Buffer.from(sellos.imatge).toString('base64');
            resSello.push(sellos);
          }
          res.render('mostrar', {
            resSello
          });
        });
      }
    });
  } catch (ex) {
    console.error("Internal error:" + ex);
    return next(ex);
  }
});

/*Aqui mostramos los sellos de cada usuario */
router.get('/mostrarSellos', auth ,function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  try {
    req.getConnection(function (err, conn) {
      if (err) {
        console.error('SQL Connection error: ', err);
        return next(err);
      } else {
        conn.query(`select inicial_pais,count(*) as total_pais from sellosUsuario group by inicial_pais`, function (err, rows, fields) {
          if (err) {
            console.error('SQL error: ', err);
            return next(err);
          }
          var resSello = [];
          for (var sello in rows) {
            var sellos = rows[sello];
            resSello.push(sellos);
          }
          res.render('mostrarSellos', {
            resSello
          });
        });
      }
    });
  } catch (ex) {
    console.error("Internal error:" + ex);
    return next(ex);
  }
});

router.get('/verPaises',auth,function(req,res,next) {
  try {
    req.getConnection(function (err, conn) {
      if (err) {
        console.error('SQL Connection error: ', err);
        return next(err);
      } else {
        conn.query(`show tables`, function (err, rows, fields) {
          if (err) {
            console.error('SQL error: ', err);
            return next(err);
          }
          var resPais = [];
          for (var pais in rows) {
            var paises = rows[pais];
            resPais.push(paises);
          }
          console.log(resPais);
          res.render('verPaises', {
            resPais
          });
        });
      }
    });
  } catch (ex) {
    console.error("Internal error:" + ex);
    return next(ex);
  }
});

/* Aqui mostramos cada sello del pais que ha elegido */
router.get('/mostrarMios/:id', auth, function (req, res, next) {
  try {
    req.getConnection(function (err, conn) {
      if (err) {
        console.error('SQL Connection error: ', err);
        return next(err);
      } else {
        conn.query(`select imatge from ${req.url.split("/")[2]} where id = (select id_foto from sellosUsuario where inicial_pais = '${req.url.split("/")[2]}' limit 1 )`, function (err, rows, fields) {
          if (err) {
            console.error('SQL error: ', err);
            return next(err);
          }
          var resSello = [];
          for (var sello in rows) {
            var sellos = rows[sello];
            sellos.imatge = Buffer.from(sellos.imatge).toString('base64');
            resSello.push(sellos);
          }
          res.render('mostrarMios', {
            resSello
          });
        });
      }
    });
  } catch (ex) {
    console.error("Internal error:" + ex);
    return next(ex);
  }
});

module.exports = router;