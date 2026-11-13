"""Create anatomically proportioned gloved first-person hands from CC0 anatomy."""
import bpy,sys,pathlib,json,math
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2];SOURCE=pathlib.Path(sys.argv[sys.argv.index('--')+1])
v=[];uv=[];faces=[];group=''
for l in (SOURCE/'base.obj').read_text().splitlines():
 if l.startswith('v '):v.append(Vector(map(float,l.split()[1:])))
 elif l.startswith('vt '):uv.append(tuple(map(float,l.split()[1:])))
 elif l.startswith('g '):group=l[2:]
 elif l.startswith('f ') and group=='body':faces.append([tuple(int(n)-1 for n in c.split('/')[:2]) for c in l.split()[1:]])
s=json.loads((SOURCE/'default.mhskel').read_text())
def j(key):
 ids=s['joints'][key];return sum((v[i] for i in ids),Vector())/len(ids)
wrist=j('wrist.L____head');palm=(j('wrist.L____tail')-wrist).normalized()
right=Vector((1,0,0));normal=right.cross(palm).normalized();right=palm.cross(normal).normalized()
faces=[f for f in faces if all(v[i].x>2.85 and v[i].y>1.05 for i,t in f)]
ids=sorted({i for f in faces for i,t in f});remap={old:new for new,old in enumerate(ids)}
verts=[]
for i in ids:
 d=(v[i]-wrist)*.105;x=d.dot(right);y=d.dot(normal);z=-d.dot(palm)
 # Fingers curve around a 5 cm grip; thumb keeps its opposing shape.
 if z<-.03 and abs(x)<.06:
  angle=min(1.95,(-z-.03)/.045);z=-.03-.045*math.sin(angle);y-=.045*(1-math.cos(angle))
 # Blender coordinates become glTF X,Y,Z on export.
 verts.append((x,-z,y))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
m=bpy.data.meshes.new('Anatomical grip');m.from_pydata(verts,[],[[remap[i] for i,t in f] for f in faces]);m.update()
ob=bpy.data.objects.new('AnatomicalGrip',m);bpy.context.collection.objects.link(ob)
for label,color in [('Glove',(.09,.115,.10)),('Sleeve',(.22,.28,.24))]:
 mat=bpy.data.materials.new(label);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.87;m.materials.append(mat)
uvlayer=m.uv_layers.new(name='UVMap')
for poly,face in zip(m.polygons,faces):
 poly.use_smooth=True;poly.material_index=int(sum(verts[remap[i]][1] for i,t in face)/len(face)<-.035)
 for li,(i,t) in zip(poly.loop_indices,face):uvlayer.data[li].uv=uv[t]
bpy.context.view_layer.objects.active=ob;ob.select_set(True);dec=ob.modifiers.new('Viewmodel budget','DECIMATE');dec.ratio=.50;bpy.ops.object.modifier_apply(modifier=dec.name)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/models/view-hand.glb'),export_format='GLB',use_selection=True,export_animations=False)
print('HAND_TRIANGLES',sum(len(p.vertices)-2 for p in ob.data.polygons))
